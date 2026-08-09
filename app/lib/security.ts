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
