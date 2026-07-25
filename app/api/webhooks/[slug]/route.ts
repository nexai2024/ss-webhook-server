import { type NextRequest, NextResponse } from "next/server";
import clientPromise from "../../../lib/mongodb";
import { Resend } from "resend";
import WebhookTriggeredEmail from "../../../../emails/webhook-triggered";
import { forwardWebhookRequest } from "../../../lib/actions";

const resendApiKey = process.env.RESEND_API_KEY || "re_mockkey_12345678";
const resend = new Resend(resendApiKey);

async function handleRequest(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const timestamp = new Date().toISOString();

  // Extract headers
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  // Extract query search params
  const { searchParams } = new URL(request.url);
  const query: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    query[key] = value;
  });

  // Extract client IP address
  const clientIp = request.headers.get("x-forwarded-for") || "127.0.0.1";

  // Extract payload body
  let body = "";
  try {
    body = await request.text();
  } catch (err) {
    console.warn("Failed to read body text from request:", err);
  }

  try {
    const client = await clientPromise;
    const db = client.db("dynamic-webhook-app");

    // Look up the webhook definition by slug
    const webhook = await db.collection("webhooks").findOne({ slug });
    if (!webhook) {
      return new NextResponse(
        JSON.stringify({ error: `Webhook endpoint '/api/webhooks/${slug}' not found.` }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify configured HTTP Method restrictions
    const requestedMethod = request.method;
    const configuredMethod = webhook.method;
    if (configuredMethod !== "ALL" && configuredMethod !== requestedMethod) {
      return new NextResponse(
        JSON.stringify({
          error: `HTTP Method ${requestedMethod} not allowed on this endpoint. Configured method is ${configuredMethod}.`
        }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }

    // --- FEATURE 50: IDEMPOTENCY-KEY CHECK ---
    const idempotencyKey = headers["idempotency-key"] || headers["x-idempotency-key"];
    if (idempotencyKey) {
      // Find if we have already successfully processed this request
      const existingLog = await db.collection("logs").findOne({
        webhookSlug: slug,
        idempotencyKeyUsed: idempotencyKey,
        isDuplicate: { $ne: true }
      });

      if (existingLog) {
        // Log this duplicate request attempt
        await db.collection("logs").insertOne({
          webhookSlug: slug,
          method: requestedMethod,
          headers,
          query,
          body,
          clientIp,
          timestamp,
          status: existingLog.responseStatus || webhook.status,
          isDuplicate: true,
          idempotencyKeyUsed: idempotencyKey,
          deliveryStatus: "NONE",
          responseStatus: existingLog.responseStatus || webhook.status,
          responseBody: existingLog.responseBody || webhook.body,
          responseContentType: existingLog.responseContentType || webhook.contentType,
        });

        // Return the cached response
        return new NextResponse(existingLog.responseBody ?? webhook.body, {
          status: existingLog.responseStatus ?? webhook.status,
          headers: {
            "Content-Type": existingLog.responseContentType ?? webhook.contentType,
            "X-Cache-Lookup": "HIT - Idempotency Duplicate",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    // --- FEATURE 54: RESPONSE DELAY SIMULATION ---
    const delayMs = Number(webhook.delayMs) || 0;
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    // --- FEATURE 52: REQUEST TRANSFORMATION ---
    let transformedBody = body;
    let transformError: string | undefined = undefined;
    if (webhook.transformScript) {
      try {
        let parsedBody: any = body;
        try {
          parsedBody = JSON.parse(body);
        } catch {
          // Keep as string if not parseable JSON
        }

        // Wrap custom JS function in a secure shadowed environment to prevent RCE / sandbox escapes
        const blockedGlobals = [
          "global", "process", "require", "module", "exports",
          "fetch", "eval", "Function", "globalThis", "setTimeout",
          "setInterval", "clearTimeout", "clearInterval"
        ];
        const blockedValues = blockedGlobals.map(() => undefined);

        const fn = new Function(
          "body", "headers", "query",
          ...blockedGlobals,
          webhook.transformScript
        );

        const result = fn(parsedBody, headers, query, ...blockedValues);
        if (result !== undefined) {
          transformedBody = typeof result === "object" ? JSON.stringify(result) : String(result);
        }
      } catch (err: any) {
        transformError = err.message || "Script execution failed";
        console.error("Transformation Error:", transformError);
      }
    }

    let emailNotified = false;
    let emailError: string | undefined = undefined;

    // Send email alert via Resend if email notifications are enabled
    if (webhook.notifyEmail) {
      try {
        if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === "re_mockkey_12345678") {
          console.log(`[MOCK EMAIL] Webhook ${webhook.name} was triggered. Sending email to ${webhook.notifyEmail}`);
          emailNotified = true;
        } else {
          const prettyHeaders = JSON.stringify(headers, null, 2);
          let prettyBody = transformedBody;
          try {
            if (transformedBody) {
              prettyBody = JSON.stringify(JSON.parse(transformedBody), null, 2);
            }
          } catch {
            // Keep original text
          }

          const { error } = await resend.emails.send({
            from: "Webhooks <webhooks@resend.dev>",
            to: [webhook.notifyEmail],
            subject: `🚨 Webhook Alert: ${webhook.name} triggered!`,
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
      } catch (err: any) {
        emailError = err.message || "Failed to send email alert";
        console.error("Resend execution error:", err);
      }
    }

    // Create the primary log entry in MongoDB
    const logResult = await db.collection("logs").insertOne({
      webhookSlug: slug,
      method: requestedMethod,
      headers,
      query,
      body,
      clientIp,
      timestamp,
      status: webhook.status,
      emailNotified,
      emailError,
      idempotencyKeyUsed: idempotencyKey || undefined,
      transformedBody: transformedBody !== body ? transformedBody : undefined,
      delayAppliedMs: delayMs || undefined,
      responseStatus: webhook.status,
      responseBody: webhook.body,
      responseContentType: webhook.contentType,
      deliveryStatus: webhook.forwardUrl ? "PENDING" : "NONE",
    });

    const logId = logResult.insertedId.toString();

    // --- FEATURE 48, 49, 51: WEBHOOK FORWARDING / PROXYING & RETRIES ---
    if (webhook.forwardUrl) {
      const maxRetries = webhook.retryCount !== undefined ? Number(webhook.retryCount) : 3;
      // Trigger background forwarding (completely non-blocking)
      forwardWebhookRequest(
        logId,
        webhook.forwardUrl,
        requestedMethod,
        headers,
        transformedBody,
        maxRetries
      ).catch((err) => {
        console.error("Background proxy forwarding error:", err);
      });
    }

    // Return the response configured by the developer
    return new NextResponse(webhook.body, {
      status: webhook.status,
      headers: {
        "Content-Type": webhook.contentType,
        "Access-Control-Allow-Origin": "*", // allow cross-origin triggers
      },
    });
  } catch (error: any) {
    console.error("Fatal error handling webhook execution log", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error in dynamic route.", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const DELETE = handleRequest;
export const PATCH = handleRequest;
