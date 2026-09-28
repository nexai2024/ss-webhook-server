import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Validates HMAC signatures from third-party webhook providers (Stripe, GitHub, Shopify, Twilio, Custom sha256).
 */
export function verifyHmacSignature(
  provider: string,
  secret: string,
  body: string,
  headers: Record<string, string>
): { valid: boolean; error?: string } {
  if (!secret) return { valid: true };
  const lowerHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    lowerHeaders[k.toLowerCase()] = v;
  }

  try {
    switch (provider.toLowerCase()) {
      case "stripe": {
        const sigHeader = lowerHeaders["stripe-signature"];
        if (!sigHeader) return { valid: false, error: "Missing Stripe-Signature header" };
        const parts = sigHeader.split(",").reduce((acc, part) => {
          const [k, v] = part.trim().split("=");
          if (k && v) acc[k] = v;
          return acc;
        }, {} as Record<string, string>);

        const t = parts["t"];
        const v1 = parts["v1"];
        if (!t || !v1) return { valid: false, error: "Invalid Stripe-Signature format" };

        const payload = `${t}.${body}`;
        const expected = createHmac("sha256", secret).update(payload).digest("hex");
        const valid =
          expected.length === v1.length &&
          timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
        return { valid, error: valid ? undefined : "Stripe HMAC signature mismatch" };
      }
      case "github": {
        const sigHeader = lowerHeaders["x-hub-signature-256"];
        if (!sigHeader) return { valid: false, error: "Missing X-Hub-Signature-256 header" };
        const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
        const valid =
          expected.length === sigHeader.length &&
          timingSafeEqual(Buffer.from(expected), Buffer.from(sigHeader));
        return { valid, error: valid ? undefined : "GitHub HMAC signature mismatch" };
      }
      case "shopify": {
        const sigHeader = lowerHeaders["x-shopify-hmac-sha256"];
        if (!sigHeader) return { valid: false, error: "Missing X-Shopify-Hmac-SHA256 header" };
        const expected = createHmac("sha256", secret).update(body).digest("base64");
        const valid =
          expected.length === sigHeader.length &&
          timingSafeEqual(Buffer.from(expected), Buffer.from(sigHeader));
        return { valid, error: valid ? undefined : "Shopify HMAC signature mismatch" };
      }
      case "twilio": {
        const sigHeader = lowerHeaders["x-twilio-signature"];
        if (!sigHeader) return { valid: false, error: "Missing X-Twilio-Signature header" };
        const expected = createHmac("sha1", secret).update(body).digest("base64");
        const valid =
          expected.length === sigHeader.length &&
          timingSafeEqual(Buffer.from(expected), Buffer.from(sigHeader));
        return { valid, error: valid ? undefined : "Twilio HMAC signature mismatch" };
      }
      case "custom":
      default: {
        const sigHeader =
          lowerHeaders["x-signature"] ||
          lowerHeaders["x-hmac-signature"] ||
          lowerHeaders["x-webhook-signature"] ||
          lowerHeaders["signature"];
        if (!sigHeader) return { valid: false, error: "Missing signature header (X-Signature)" };
        const expectedHex = createHmac("sha256", secret).update(body).digest("hex");
        const expectedB64 = createHmac("sha256", secret).update(body).digest("base64");
        const valid =
          (sigHeader.length === expectedHex.length &&
            timingSafeEqual(Buffer.from(expectedHex), Buffer.from(sigHeader))) ||
          (sigHeader.length === expectedB64.length &&
            timingSafeEqual(Buffer.from(expectedB64), Buffer.from(sigHeader)));
        return { valid, error: valid ? undefined : "Custom HMAC signature mismatch" };
      }
    }
  } catch (err: unknown) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "HMAC verification exception",
    };
  }
}

/**
 * Validates payload body structure against a JSON Schema.
 */
export function validateJsonSchema(
  schemaStr: string,
  bodyStr: string
): { valid: boolean; error?: string } {
  if (!schemaStr.trim()) return { valid: true };
  let schemaObj: Record<string, unknown>;
  try {
    schemaObj = JSON.parse(schemaStr);
  } catch {
    return { valid: false, error: "Configured JSON Schema is invalid JSON syntax" };
  }

  let bodyObj: Record<string, unknown>;
  try {
    bodyObj = JSON.parse(bodyStr);
  } catch {
    return { valid: false, error: "Request payload body is not valid JSON" };
  }

  if (Array.isArray(schemaObj.required)) {
    for (const reqField of schemaObj.required) {
      if (bodyObj == null || typeof bodyObj !== "object" || !(reqField in bodyObj)) {
        return { valid: false, error: `Missing required property '${reqField}'` };
      }
    }
  }

  if (schemaObj.properties && typeof schemaObj.properties === "object") {
    for (const [propKey, propRules] of Object.entries<Record<string, unknown>>(
      schemaObj.properties as Record<string, Record<string, unknown>>
    )) {
      if (bodyObj && propKey in bodyObj && propRules && typeof propRules.type === "string") {
        const actualType = Array.isArray(bodyObj[propKey]) ? "array" : typeof bodyObj[propKey];
        if (actualType !== propRules.type) {
          return {
            valid: false,
            error: `Property '${propKey}' expected type '${propRules.type}', got '${actualType}'`,
          };
        }
      }
    }
  }

  return { valid: true };
}

/**
 * Evaluates conditional routing / path filter rules on request payload.
 */
export function evaluateFilterRules(
  rulesStr: string,
  bodyStr: string
): { matches: boolean; reason?: string } {
  if (!rulesStr.trim()) return { matches: true };

  let bodyObj: Record<string, unknown> | string;
  try {
    bodyObj = JSON.parse(bodyStr);
  } catch {
    bodyObj = bodyStr;
  }

  try {
    if (rulesStr.startsWith("{")) {
      const ruleObj = JSON.parse(rulesStr) as Record<string, unknown>;
      for (const [key, val] of Object.entries(ruleObj)) {
        const bodyVal =
          typeof bodyObj === "object" && bodyObj !== null
            ? (bodyObj as Record<string, unknown>)[key]
            : undefined;
        if (String(bodyVal) !== String(val)) {
          return { matches: false, reason: `Rule field '${key}' expected '${val}', got '${bodyVal}'` };
        }
      }
    } else if (rulesStr.includes("=")) {
      const [key, val] = rulesStr.split("=").map((s) => s.trim());
      const bodyVal =
        typeof bodyObj === "object" && bodyObj !== null
          ? (bodyObj as Record<string, unknown>)[key]
          : undefined;
      if (String(bodyVal) !== String(val)) {
        return { matches: false, reason: `Rule field '${key}' expected '${val}', got '${bodyVal}'` };
      }
    } else {
      if (!bodyStr.includes(rulesStr)) {
        return { matches: false, reason: `Payload does not contain required substring '${rulesStr}'` };
      }
    }
  } catch (err: unknown) {
    return {
      matches: false,
      reason: `Filter rule evaluation error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return { matches: true };
}

/**
 * Dispatches alert notifications to Slack, Discord, or PagerDuty webhooks.
 */
export async function sendSlackAlert(url: string, message: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendDiscordAlert(url: string, message: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendPagerDutyAlert(routingKey: string, summary: string): Promise<boolean> {
  try {
    const res = await fetch("https://events.pagerduty.com/v2/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        routing_key: routingKey,
        event_action: "trigger",
        payload: {
          summary,
          severity: "error",
          source: "Endpoint Builders Webhook Gateway",
        },
      }),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
