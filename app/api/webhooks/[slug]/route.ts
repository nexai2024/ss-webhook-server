import { type NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import WebhookTriggeredEmail from "../../../../emails/webhook-triggered";
import { getDb } from "../../../lib/db";
import { assertWebhookRateLimit } from "../../../lib/rate-limit";
import {
  contentLengthTooLarge,
  getMaxBodyBytes,
  redactHeaders,
} from "../../../lib/security";

const MOCK_RESEND_KEY = "re_mockkey_12345678";

function jsonError(status: number, error: string, extraHeaders?: Record<string, string>) {
  return new NextResponse(JSON.stringify({ error }), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

function isResendConfigured(): boolean {
  const key = process.env.RESEND_API_KEY;
  return Boolean(key && key !== MOCK_RESEND_KEY);
}

async function handleRequest(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const timestamp = new Date().toISOString();
  const maxBodyBytes = getMaxBodyBytes();

  if (contentLengthTooLarge(request.headers.get("content-length"), maxBodyBytes)) {
    return jsonError(413, `Request body exceeds limit of ${maxBodyBytes} bytes.`);
  }

  const rawHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    rawHeaders[key] = value;
  });
  const headers = redactHeaders(rawHeaders);

  const { searchParams } = new URL(request.url);
  const query: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    query[key] = value;
  });

  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1";

  let body = "";
  try {
    body = await request.text();
  } catch (err) {
    console.warn("Failed to read body text from request:", err);
  }

  if (new TextEncoder().encode(body).length > maxBodyBytes) {
    return jsonError(413, `Request body exceeds limit of ${maxBodyBytes} bytes.`);
  }

  try {
    const db = await getDb();

    const rate = await assertWebhookRateLimit(db, slug);
    if (!rate.allowed) {
      return jsonError(429, "Rate limit exceeded for this endpoint. Try again shortly.", {
        "Retry-After": String(rate.retryAfterSec),
        "X-RateLimit-Limit": String(rate.limit),
        "X-RateLimit-Remaining": "0",
      });
    }

    const webhook = await db.collection("webhooks").findOne({ slug });
    if (!webhook) {
      return jsonError(404, `Webhook endpoint '/api/webhooks/${slug}' not found.`);
    }

    const requestedMethod = request.method;
    const configuredMethod = webhook.method;
    if (configuredMethod !== "ALL" && configuredMethod !== requestedMethod) {
      return jsonError(
        405,
        `HTTP Method ${requestedMethod} not allowed on this endpoint. Configured method is ${configuredMethod}.`
      );
    }

    let emailNotified = false;
    let emailError: string | undefined;

    if (webhook.notifyEmail) {
      try {
        if (!isResendConfigured()) {
          if (process.env.NODE_ENV === "production") {
            emailError = "Email delivery is not configured in production";
            console.error(emailError);
          } else {
            console.log(
              `[MOCK EMAIL] Webhook ${webhook.name} was triggered. Would notify ${webhook.notifyEmail}`
            );
            emailNotified = true;
          }
        } else {
          const resend = new Resend(process.env.RESEND_API_KEY);
          const from =
            process.env.RESEND_FROM || "Endpoint Builders <webhooks@resend.dev>";

          const prettyHeaders = JSON.stringify(headers, null, 2);
          let prettyBody = body;
          try {
            if (body) {
              prettyBody = JSON.stringify(JSON.parse(body), null, 2);
            }
          } catch {
            // keep original text body
          }

          const { error } = await resend.emails.send({
            from,
            to: [webhook.notifyEmail],
            subject: `Endpoint Builders: ${webhook.name} triggered`,
            react: WebhookTriggeredEmail({
              slug,
              name: webhook.name,
              method: requestedMethod,
              clientIp,
              timestamp,
              headersJson: prettyHeaders,
              bodyJson: prettyBody,
            }),
          });

          if (error) {
            emailError = error.message;
            console.error("Resend delivery failed:", error.message);
          } else {
            emailNotified = true;
          }
        }
      } catch (err: unknown) {
        emailError = err instanceof Error ? err.message : "Failed to send email alert";
        console.error("Resend execution error:", err);
      }
    }

    await db.collection("logs").insertOne({
      webhookSlug: slug,
      method: requestedMethod,
      headers,
      query,
      body,
      clientIp,
      timestamp,
      createdAt: new Date(),
      status: webhook.status,
      emailNotified,
      emailError,
    });

    return new NextResponse(webhook.body, {
      status: webhook.status,
      headers: {
        "Content-Type": webhook.contentType,
        "Access-Control-Allow-Origin": "*",
        "X-RateLimit-Limit": String(rate.limit),
        "X-RateLimit-Remaining": String(rate.remaining),
      },
    });
  } catch (error: unknown) {
    console.error("Fatal error handling webhook execution log", error);
    return jsonError(500, "Internal server error");
  }
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const DELETE = handleRequest;
export const PATCH = handleRequest;
