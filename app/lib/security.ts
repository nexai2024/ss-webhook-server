import { randomBytes } from "node:crypto";

const SENSITIVE_HEADER =
  /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-auth-token|x-access-token|x-csrf-token)$/i;

export const DEFAULT_MAX_BODY_BYTES = 1_048_576; // 1 MiB

/**
 * Generate an unguessable URL slug for public webhook endpoints.
 */
export function generateEndpointSlug(): string {
  return randomBytes(12).toString("base64url");
}

/**
 * Normalize a user-provided slug or return empty string if invalid after cleanup.
 */
export function normalizeSlug(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Redact sensitive headers before persistence or email.
 */
export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    redacted[key] = SENSITIVE_HEADER.test(key) ? "[REDACTED]" : value;
  }
  return redacted;
}

export function getMaxBodyBytes(): number {
  const parsed = Number.parseInt(process.env.WEBHOOK_MAX_BODY_BYTES || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_BODY_BYTES;
}

/**
 * Returns an error message if Content-Length exceeds the configured max.
 */
export function contentLengthTooLarge(contentLengthHeader: string | null, maxBytes: number): boolean {
  if (!contentLengthHeader) return false;
  const length = Number.parseInt(contentLengthHeader, 10);
  return Number.isFinite(length) && length > maxBytes;
}

/**
 * Validates HTTP Basic Auth header against configured username & password or password gate.
 */
export function validateBasicAuth(
  authHeader: string | null,
  expectedUsername?: string,
  expectedPassword?: string
): { valid: boolean; reason?: string } {
  if (!expectedUsername && !expectedPassword) {
    return { valid: true };
  }

  if (!authHeader) {
    return { valid: false, reason: "Missing Authorization header" };
  }

  if (authHeader.startsWith("Basic ")) {
    const credentials = Buffer.from(authHeader.substring(6), "base64").toString("utf-8");
    const [user, pass] = credentials.split(":");

    if (expectedUsername && user !== expectedUsername) {
      return { valid: false, reason: "Invalid Basic Auth username" };
    }
    if (expectedPassword && pass !== expectedPassword) {
      return { valid: false, reason: "Invalid Basic Auth password" };
    }

    return { valid: true };
  } else if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    if (expectedPassword && token !== expectedPassword) {
      return { valid: false, reason: "Invalid Bearer password token" };
    }
    return { valid: true };
  }

  return { valid: false, reason: "Unsupported Authorization header scheme" };
}

/**
 * Checks if endpoint TTL or max requests policy has expired.
 */
export function isEndpointExpired(
  expiresAt?: string,
  maxRequests?: number,
  currentRequestsCount?: number
): { expired: boolean; reason?: string } {
  if (expiresAt) {
    const expDate = new Date(expiresAt).getTime();
    if (!Number.isNaN(expDate) && Date.now() > expDate) {
      return { expired: true, reason: `Endpoint expired on ${new Date(expiresAt).toUTCString()}` };
    }
  }

  if (maxRequests !== undefined && maxRequests > 0 && currentRequestsCount !== undefined) {
    if (currentRequestsCount >= maxRequests) {
      return { expired: true, reason: `Endpoint request quota reached (${currentRequestsCount}/${maxRequests} requests captured)` };
    }
  }

  return { expired: false };
}
