import { type NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import WebhookTriggeredEmail from "../../../../emails/webhook-triggered";
import { forwardWebhookRequest } from "../../../lib/actions";
import { BILLING, isUserPremium } from "../../../lib/billing";
import { executeSaaSConnectors } from "../../../lib/connectors";
import { getDb } from "../../../lib/db";
import { assertWebhookRateLimit } from "../../../lib/rate-limit";
import {
  contentLengthTooLarge,
  getMaxBodyBytes,
  isEndpointExpired,
  redactHeaders,
  validateBasicAuth,
} from "../../../lib/security";
import {
  evaluateFilterRules,
  sendDiscordAlert,
  sendPagerDutyAlert,
  sendSlackAlert,
  validateJsonSchema,
  verifyHmacSignature,
} from "../../../lib/verification";
import { broadcastWebhookEvent } from "./stream/pubsub";

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

    const webhook = await db.collection("webhooks").findOne({ slug });
    if (!webhook) {
      return jsonError(404, `Webhook endpoint '/api/webhooks/${slug}' not found.`);
    }

    const isPremium = await isUserPremium(db, webhook.userId);

    // Enforce endpoint cap on Cloud Free tier (downgrade protection)
    if (!isPremium) {
      const userWebhooks = await db
        .collection("webhooks")
        .find({ userId: webhook.userId })
        .sort({ createdAt: 1 })
        .toArray();

      const endpointIndex = userWebhooks.findIndex((w) => w.slug === slug);
      if (endpointIndex >= BILLING.freeEndpointLimit) {
        return jsonError(
          403,
          `Endpoint disabled. Cloud Free tier allows up to ${BILLING.freeEndpointLimit} endpoints. Upgrade to Cloud Premium to re-enable this endpoint.`
        );
      }
    }

    // --- NICE-TO-HAVE FEATURE 4: HTTP BASIC AUTH / PASSWORD PROTECTION ---
    if (webhook.basicAuthUsername || webhook.basicAuthPassword) {
      const authHeader = request.headers.get("authorization");
      const authResult = validateBasicAuth(
        authHeader,
        webhook.basicAuthUsername,
        webhook.basicAuthPassword
      );

      if (!authResult.valid) {
        await db.collection("logs").insertOne({
          webhookSlug: slug,
          method: request.method,
          headers,
          query,
          body,
          clientIp,
          timestamp,
          status: 401,
          authError: authResult.reason,
          deliveryStatus: "NONE",
        });

        return jsonError(401, `HTTP Basic Auth Failed: ${authResult.reason}`, {
          "WWW-Authenticate": 'Basic realm="Webhook Protected"',
        });
      }
    }

    // --- NICE-TO-HAVE FEATURE 3: ENDPOINT TTL / EXPIRED / MAX REQUESTS POLICY ---
    const totalRequestsCount = await db.collection("logs").countDocuments({ webhookSlug: slug });
    const ttlCheck = isEndpointExpired(webhook.expiresAt, webhook.maxRequests, totalRequestsCount);
    if (ttlCheck.expired) {
      await db.collection("logs").insertOne({
        webhookSlug: slug,
        method: request.method,
        headers,
        query,
        body,
        clientIp,
        timestamp,
        status: 410,
        ttlExpired: true,
        ttlReason: ttlCheck.reason,
        deliveryStatus: "NONE",
      });

      return jsonError(410, `Endpoint Expired / Quota Exceeded: ${ttlCheck.reason}`);
    }

    const rate = await assertWebhookRateLimit(db, slug, isPremium);
    if (!rate.allowed) {
      return jsonError(429, "Rate limit exceeded for this endpoint. Try again shortly.", {
        "Retry-After": String(rate.retryAfterSec),
        "X-RateLimit-Limit": String(rate.limit),
        "X-RateLimit-Remaining": "0",
      });
    }

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

    // Enforce allowed response status on Free tier
    let responseStatus = Number(webhook.status) || 200;
    if (!isPremium) {
      const freeStatuses: readonly number[] = BILLING.freeAllowedStatuses;
      if (!freeStatuses.includes(responseStatus)) {
        responseStatus = 200;
      }
    }

    // --- MUST-HAVE FEATURE 1: HMAC SIGNATURE VERIFICATION ---
    if (webhook.hmacSecret) {
      const hmacResult = verifyHmacSignature(
        webhook.hmacProvider || "custom",
        webhook.hmacSecret,
        body,
        headers
      );

      if (!hmacResult.valid) {
        await db.collection("logs").insertOne({
          webhookSlug: slug,
          method: requestedMethod,
          headers,
          query,
          body,
          clientIp,
          timestamp,
          status: 401,
          hmacVerified: false,
          hmacError: hmacResult.error,
          deliveryStatus: "NONE",
        });

        return jsonError(401, `HMAC Verification Failed: ${hmacResult.error}`);
      }
    }

    // --- MUST-HAVE FEATURE 2: JSON SCHEMA VALIDATION ---
    if (webhook.jsonSchema) {
      const schemaResult = validateJsonSchema(webhook.jsonSchema, body);
      if (!schemaResult.valid) {
        await db.collection("logs").insertOne({
          webhookSlug: slug,
          method: requestedMethod,
          headers,
          query,
          body,
          clientIp,
          timestamp,
          status: 422,
          schemaError: schemaResult.error,
          deliveryStatus: "NONE",
        });

        return jsonError(422, `JSON Schema Validation Failed: ${schemaResult.error}`);
      }
    }

    // --- MUST-HAVE FEATURE 3: CONDITIONAL PAYLOAD FILTERING ---
    if (webhook.filterRules) {
      const filterResult = evaluateFilterRules(webhook.filterRules, body);
      if (!filterResult.matches) {
        await db.collection("logs").insertOne({
          webhookSlug: slug,
          method: requestedMethod,
          headers,
          query,
          body,
          clientIp,
          timestamp,
          status: 200,
          isFiltered: true,
          filterReason: filterResult.reason,
          deliveryStatus: "NONE",
        });

        return new NextResponse(
          JSON.stringify({ status: "filtered", reason: filterResult.reason }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // --- FEATURE 50: IDEMPOTENCY-KEY CHECK ---
    const idempotencyKey = headers["idempotency-key"] || headers["x-idempotency-key"];
    if (idempotencyKey) {
      const existingLog = await db.collection("logs").findOne({
        webhookSlug: slug,
        idempotencyKeyUsed: idempotencyKey,
        isDuplicate: { $ne: true }
      });

      if (existingLog) {
        await db.collection("logs").insertOne({
          webhookSlug: slug,
          method: requestedMethod,
          headers,
          query,
          body,
          clientIp,
          timestamp,
          status: existingLog.responseStatus || responseStatus,
          isDuplicate: true,
          idempotencyKeyUsed: idempotencyKey,
          deliveryStatus: "NONE",
          responseStatus: existingLog.responseStatus || responseStatus,
          responseBody: existingLog.responseBody || webhook.body,
          responseContentType: existingLog.responseContentType || webhook.contentType,
        });

        return new NextResponse(existingLog.responseBody ?? webhook.body, {
          status: existingLog.responseStatus ?? responseStatus,
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

    // --- NICE-TO-HAVE FEATURE 2: 3RD-PARTY SAAS CONNECTORS EXECUTION ---
    let connectorResults = undefined;
    if (Array.isArray(webhook.saasConnectors) && webhook.saasConnectors.length > 0) {
      connectorResults = await executeSaaSConnectors(webhook.saasConnectors, {
        body: transformedBody,
        headers,
        query,
        timestamp,
        slug,
      });
    }

    let emailNotified = false;
    let emailError: string | undefined;
    let slackNotified = false;
    let discordNotified = false;
    let pagerDutyNotified = false;

    // --- MUST-HAVE FEATURE 4: SLACK, DISCORD, PAGERDUTY ALERTS ---
    const alertMessage = `Endpoint Builders Alert: Webhook '${webhook.name}' (/api/webhooks/${slug}) received ${requestedMethod} from ${clientIp} at ${timestamp}`;

    if (webhook.notifySlackUrl) {
      slackNotified = await sendSlackAlert(webhook.notifySlackUrl, alertMessage);
    }
    if (webhook.notifyDiscordUrl) {
      discordNotified = await sendDiscordAlert(webhook.notifyDiscordUrl, alertMessage);
    }
    if (webhook.notifyPagerDutyKey) {
      pagerDutyNotified = await sendPagerDutyAlert(webhook.notifyPagerDutyKey, alertMessage);
    }

    if (webhook.notifyEmail && isPremium) {
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
          let prettyBody = transformedBody;
          try {
            if (transformedBody) {
              prettyBody = JSON.stringify(JSON.parse(transformedBody), null, 2);
            }
          } catch {
            // Keep original text
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

    // Create the primary log entry in MongoDB
    const logResult = await db.collection("logs").insertOne({
      webhookSlug: slug,
      method: requestedMethod,
      headers,
      query,
      body,
      clientIp,
      timestamp,
      createdAt: new Date(),
      status: responseStatus,
      emailNotified,
      emailError,
      idempotencyKeyUsed: idempotencyKey || undefined,
      transformedBody: transformedBody !== body ? transformedBody : undefined,
      delayAppliedMs: delayMs || undefined,
      responseStatus: responseStatus,
      responseBody: webhook.body,
      responseContentType: webhook.contentType,
      slackNotified: slackNotified || undefined,
      discordNotified: discordNotified || undefined,
      pagerDutyNotified: pagerDutyNotified || undefined,
      hmacVerified: webhook.hmacSecret ? true : undefined,
      connectorResults,
      deliveryStatus: (webhook.forwardUrls?.length || webhook.forwardUrl) ? "PENDING" : "NONE",
    });

    const logId = logResult.insertedId.toString();

    // Broadcast event to connected SSE subscribers (Real-time live streaming)
    broadcastWebhookEvent(slug, {
      _id: logId,
      webhookSlug: slug,
      method: requestedMethod,
      headers,
      query,
      body,
      clientIp,
      timestamp,
      transformedBody,
    });

    // --- MUST-HAVE FEATURE 5: MULTI-DESTINATION FAN-OUT PROXYING & RETRIES ---
    const targets: string[] = Array.isArray(webhook.forwardUrls) && webhook.forwardUrls.length > 0
      ? webhook.forwardUrls
      : webhook.forwardUrl ? [webhook.forwardUrl] : [];

    if (targets.length > 0) {
      const maxRetries = webhook.retryCount !== undefined ? Number(webhook.retryCount) : 3;
      const asymmetricConfig = webhook.asymmetricSigningEnabled && webhook.privateKey
        ? { privateKey: webhook.privateKey, keyType: webhook.asymmetricKeyType || "ed25519", publicKey: webhook.publicKey || "" }
        : undefined;

      // Trigger background forwarding for all fan-out targets
      for (const targetUrl of targets) {
        forwardWebhookRequest(
          logId,
          targetUrl,
          requestedMethod,
          headers,
          transformedBody,
          maxRetries,
          asymmetricConfig
        ).catch((err) => {
          console.error(`Background proxy forwarding error to ${targetUrl}:`, err);
        });
      }
    }

    return new NextResponse(webhook.body, {
      status: responseStatus,
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
