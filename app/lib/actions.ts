"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import { generateAsymmetricKeyPair, signAsymmetricPayload } from "./asymmetric";
import { BILLING, getEntitlements } from "./billing";
import type { SaaSConnectorConfig, ConnectorExecutionResult } from "./connectors";
import { getDb } from "./db";
import { generateEndpointSlug, normalizeSlug } from "./security";

export interface DeliveryAttempt {
  attempt: number;
  timestamp: string;
  status: "SUCCESS" | "FAILED";
  statusCode?: number;
  error?: string;
}

export interface WebhookDefinition {
  _id?: string;
  userId: string;
  slug: string;
  name: string;
  method: string;
  status: number;
  contentType: string;
  body: string;
  notifyEmail?: string;
  notifySlackUrl?: string;
  notifyDiscordUrl?: string;
  notifyPagerDutyKey?: string;
  createdAt: string;
  forwardUrl?: string;
  forwardUrls?: string[];
  retryCount?: number;
  transformScript?: string;
  cronSchedule?: string;
  delayMs?: number;
  hmacSecret?: string;
  hmacProvider?: string;
  jsonSchema?: string;
  filterRules?: string;
  isLimitExceeded?: boolean;

  // New features
  ttlDays?: number;
  expiresAt?: string;
  maxRequests?: number;
  basicAuthUsername?: string;
  basicAuthPassword?: string;
  asymmetricSigningEnabled?: boolean;
  asymmetricKeyType?: "ed25519" | "rsa";
  privateKey?: string;
  publicKey?: string;
  saasConnectors?: SaaSConnectorConfig[];
}

export interface WebhookRequestLog {
  _id?: string;
  webhookSlug: string;
  method: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: string;
  clientIp: string;
  timestamp: string;
  emailNotified?: boolean;
  emailError?: string;
  slackNotified?: boolean;
  discordNotified?: boolean;
  pagerDutyNotified?: boolean;
  forwardedUrl?: string;
  forwardStatus?: number;
  forwardResponse?: string;
  deliveries?: DeliveryAttempt[];
  isDuplicate?: boolean;
  idempotencyKeyUsed?: string;
  transformedBody?: string;
  delayAppliedMs?: number;
  deliveryStatus?: "SUCCESS" | "PENDING" | "DLQ" | "NONE";
  responseStatus?: number;
  responseBody?: string;
  responseContentType?: string;
  hmacVerified?: boolean;
  hmacError?: string;
  schemaError?: string;
  isFiltered?: boolean;
  filterReason?: string;
}

export interface UserTierInfo {
  isPremium: boolean;
  activePlan: string;
  endpointsCount: number;
  exceededEndpointsCount?: number;
}

export type WebhookState = { error: string } | { data: WebhookDefinition };

/** Strip Mongo ObjectIds / non-plain values before crossing the RSC boundary */
function serializeWebhook(doc: Record<string, unknown>): WebhookDefinition {
  const id = doc._id;
  return {
    _id: id != null ? String(id) : undefined,
    userId: String(doc.userId ?? ""),
    name: String(doc.name ?? ""),
    slug: String(doc.slug ?? ""),
    method: String(doc.method ?? "POST"),
    status: Number(doc.status) || 200,
    contentType: String(doc.contentType ?? "application/json"),
    body: String(doc.body ?? ""),
    notifyEmail: doc.notifyEmail != null ? String(doc.notifyEmail) : undefined,
    notifySlackUrl: doc.notifySlackUrl != null ? String(doc.notifySlackUrl) : undefined,
    notifyDiscordUrl: doc.notifyDiscordUrl != null ? String(doc.notifyDiscordUrl) : undefined,
    notifyPagerDutyKey: doc.notifyPagerDutyKey != null ? String(doc.notifyPagerDutyKey) : undefined,
    forwardUrl: doc.forwardUrl != null ? String(doc.forwardUrl) : undefined,
    forwardUrls: Array.isArray(doc.forwardUrls) ? doc.forwardUrls.map(String) : undefined,
    retryCount: doc.retryCount != null ? Number(doc.retryCount) : undefined,
    transformScript:
      doc.transformScript != null ? String(doc.transformScript) : undefined,
    cronSchedule: doc.cronSchedule != null ? String(doc.cronSchedule) : undefined,
    delayMs: doc.delayMs != null ? Number(doc.delayMs) : undefined,
    hmacSecret: doc.hmacSecret != null ? String(doc.hmacSecret) : undefined,
    hmacProvider: doc.hmacProvider != null ? String(doc.hmacProvider) : undefined,
    jsonSchema: doc.jsonSchema != null ? String(doc.jsonSchema) : undefined,
    filterRules: doc.filterRules != null ? String(doc.filterRules) : undefined,
    createdAt: String(doc.createdAt ?? ""),

    // New feature fields
    ttlDays: doc.ttlDays != null ? Number(doc.ttlDays) : undefined,
    expiresAt: doc.expiresAt != null ? String(doc.expiresAt) : undefined,
    maxRequests: doc.maxRequests != null ? Number(doc.maxRequests) : undefined,
    basicAuthUsername: doc.basicAuthUsername != null ? String(doc.basicAuthUsername) : undefined,
    basicAuthPassword: doc.basicAuthPassword != null ? String(doc.basicAuthPassword) : undefined,
    asymmetricSigningEnabled: doc.asymmetricSigningEnabled != null ? Boolean(doc.asymmetricSigningEnabled) : undefined,
    asymmetricKeyType: (doc.asymmetricKeyType === "rsa" ? "rsa" : "ed25519") as "ed25519" | "rsa",
    privateKey: doc.privateKey != null ? String(doc.privateKey) : undefined,
    publicKey: doc.publicKey != null ? String(doc.publicKey) : undefined,
    saasConnectors: Array.isArray(doc.saasConnectors) ? (doc.saasConnectors as SaaSConnectorConfig[]) : undefined,
  };
}

/**
 * Gets the current user's subscription tier and usage statistics
 */
export async function getUserTier(): Promise<UserTierInfo> {
  try {
    const { userId, has } = await auth();
    if (!userId) {
      return { isPremium: false, activePlan: "Guest", endpointsCount: 0, exceededEndpointsCount: 0 };
    }

    const db = await getDb();
    const count = await db.collection("webhooks").countDocuments({ userId });
    const entitlements = getEntitlements(has);
    const isPremium =
      entitlements.isPremium ||
      entitlements.canCreateUnlimitedEndpoints ||
      entitlements.canUseEmailAlerts;

    const exceeded = !isPremium && count > BILLING.freeEndpointLimit
      ? count - BILLING.freeEndpointLimit
      : 0;

    return {
      isPremium,
      activePlan: entitlements.activePlan,
      endpointsCount: count,
      exceededEndpointsCount: exceeded,
    };
  } catch (e) {
    console.error("Error fetching user tier info", e);
    return { isPremium: false, activePlan: "Cloud Free", endpointsCount: 0, exceededEndpointsCount: 0 };
  }
}

/**
 * Creates a dynamic webhook endpoint configuration
 */
export async function createWebhook(prevState: any, formData: FormData): Promise<WebhookState> {
  try {
    const { userId, has } = await auth();
    if (!userId) {
      return { error: "You must be signed in to configure webhooks." };
    }

    const name = (formData.get("name") as string) || "My Webhook";
    let slug = (formData.get("slug") as string) || "";
    const method = (formData.get("method") as string) || "POST";
    const statusStr = (formData.get("status") as string) || "200";
    const contentType = (formData.get("contentType") as string) || "application/json";
    const body = (formData.get("body") as string) || "{\"ok\": true}";
    const notifyEmail = (formData.get("notifyEmail") as string) || "";
    const notifySlackUrl = (formData.get("notifySlackUrl") as string) || "";
    const notifyDiscordUrl = (formData.get("notifyDiscordUrl") as string) || "";
    const notifyPagerDutyKey = (formData.get("notifyPagerDutyKey") as string) || "";
    const forwardUrl = (formData.get("forwardUrl") as string) || "";
    const forwardUrlsStr = (formData.get("forwardUrls") as string) || "";
    const retryCountStr = (formData.get("retryCount") as string) || "3";
    const transformScript = (formData.get("transformScript") as string) || "";
    const cronSchedule = (formData.get("cronSchedule") as string) || "";
    const delayMsStr = (formData.get("delayMs") as string) || "0";
    const hmacSecret = (formData.get("hmacSecret") as string) || "";
    const hmacProvider = (formData.get("hmacProvider") as string) || "custom";
    const jsonSchema = (formData.get("jsonSchema") as string) || "";
    const filterRules = (formData.get("filterRules") as string) || "";

    const parsedForwardUrls = forwardUrlsStr
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0);
    if (forwardUrl.trim() && !parsedForwardUrls.includes(forwardUrl.trim())) {
      parsedForwardUrls.unshift(forwardUrl.trim());
    }

    const status = Number.parseInt(statusStr, 10) || 200;
    const retryCount = Number.parseInt(retryCountStr, 10) || 3;
    const delayMs = Number.parseInt(delayMsStr, 10) || 0;
    const ttlDays = ttlDaysStr ? Number.parseInt(ttlDaysStr, 10) : undefined;
    const maxRequests = maxRequestsStr ? Number.parseInt(maxRequestsStr, 10) : undefined;

    let expiresAt: string | undefined = undefined;
    if (ttlDays && ttlDays > 0) {
      const exp = new Date();
      exp.setDate(exp.getDate() + ttlDays);
      expiresAt = exp.toISOString();
    }

    let parsedConnectors: SaaSConnectorConfig[] | undefined = undefined;
    if (saasConnectorsJson.trim()) {
      try {
        parsedConnectors = JSON.parse(saasConnectorsJson);
      } catch {
        // Ignore invalid JSON
      }
    }

    let privateKey: string | undefined = undefined;
    let publicKey: string | undefined = undefined;
    if (asymmetricSigningEnabled) {
      const keys = generateAsymmetricKeyPair(asymmetricKeyType);
      privateKey = keys.privateKey;
      publicKey = keys.publicKey;
    }

    const entitlements = getEntitlements(has);

    const db = await getDb();

    const count = await db.collection("webhooks").countDocuments({ userId });
    if (!entitlements.canCreateUnlimitedEndpoints && count >= BILLING.freeEndpointLimit) {
      return {
        error: `Free tier limit reached. You can only create up to ${BILLING.freeEndpointLimit} endpoints. Upgrade to Cloud Premium for unlimited endpoints.`,
      };
    }

    if (notifyEmail.trim() && !entitlements.canUseEmailAlerts) {
      return {
        error: "Instant email alerts require Cloud Premium (or the email_alerts feature). Upgrade on the Pricing page.",
      };
    }

    const freeStatuses: readonly number[] = BILLING.freeAllowedStatuses;
    if (!entitlements.canUseCustomStatus && !freeStatuses.includes(status)) {
      return {
        error: "Custom response statuses (other than 200/201/204) require Cloud Premium. Upgrade on the Pricing page.",
      };
    }

    if (!slug) {
      slug = generateEndpointSlug();
    } else {
      slug = normalizeSlug(slug);
      if (!slug) {
        return { error: "Invalid endpoint slug. Use letters, numbers, hyphens, or underscores." };
      }
    }

    const existing = await db.collection("webhooks").findOne({ slug });
    if (existing) {
      return { error: `The endpoint path '/api/webhooks/${slug}' is already taken. Please choose a different one.` };
    }

    const newWebhook = {
      userId,
      name,
      slug,
      method,
      status,
      contentType,
      body,
      notifyEmail: notifyEmail.trim() || undefined,
      notifySlackUrl: notifySlackUrl.trim() || undefined,
      notifyDiscordUrl: notifyDiscordUrl.trim() || undefined,
      notifyPagerDutyKey: notifyPagerDutyKey.trim() || undefined,
      forwardUrl: forwardUrl.trim() || undefined,
      forwardUrls: parsedForwardUrls.length > 0 ? parsedForwardUrls : undefined,
      retryCount: (forwardUrl.trim() || parsedForwardUrls.length > 0) ? retryCount : undefined,
      transformScript: transformScript.trim() || undefined,
      cronSchedule: cronSchedule.trim() || undefined,
      delayMs: delayMs > 0 ? delayMs : undefined,
      hmacSecret: hmacSecret.trim() || undefined,
      hmacProvider: hmacSecret.trim() ? hmacProvider : undefined,
      jsonSchema: jsonSchema.trim() || undefined,
      filterRules: filterRules.trim() || undefined,
      createdAt: new Date().toISOString(),

      // New feature fields
      ttlDays,
      expiresAt,
      maxRequests,
      basicAuthUsername: basicAuthUsername.trim() || undefined,
      basicAuthPassword: basicAuthPassword.trim() || undefined,
      asymmetricSigningEnabled,
      asymmetricKeyType: asymmetricSigningEnabled ? asymmetricKeyType : undefined,
      privateKey,
      publicKey,
      saasConnectors: parsedConnectors,
    };

    try {
      const insertResult = await db.collection("webhooks").insertOne(newWebhook);
      revalidatePath("/");
      return {
        data: serializeWebhook({
          ...newWebhook,
          _id: insertResult.insertedId,
        }),
      };
    } catch (insertErr: unknown) {
      if (
        typeof insertErr === "object" &&
        insertErr !== null &&
        "code" in insertErr &&
        (insertErr as { code?: number }).code === 11000
      ) {
        return { error: `The endpoint path '/api/webhooks/${slug}' is already taken. Please choose a different one.` };
      }
      throw insertErr;
    }
  } catch (e: unknown) {
    console.error("Error creating webhook configuration", e);
    return { error: e instanceof Error ? e.message : "An unexpected error occurred." };
  }
}

/**
 * Retrieves all registered dynamic webhooks for the authenticated user
 */
export async function getWebhooks(): Promise<WebhookDefinition[]> {
  try {
    const { userId, has } = await auth();
    if (!userId) return [];

    const db = await getDb();
    const docs = await db
      .collection("webhooks")
      .find({ userId })
      .sort({ createdAt: 1 })
      .toArray();

    const entitlements = getEntitlements(has);
    const canUnlimited = entitlements.canCreateUnlimitedEndpoints;

    const list = docs.map((doc, index) => {
      const wh = serializeWebhook(doc as Record<string, unknown>);
      if (!canUnlimited && index >= BILLING.freeEndpointLimit) {
        wh.isLimitExceeded = true;
      }
      return wh;
    });

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (e) {
    console.error("Error fetching webhooks from MongoDB", e);
    return [];
  }
}

/**
 * Retrieves incoming request logs for a specific webhook slug belonging to the authenticated user
 */
export async function getWebhookLogs(slug: string): Promise<WebhookRequestLog[]> {
  if (!slug) return [];
  try {
    const { userId } = await auth();
    if (!userId) return [];

    const db = await getDb();

    const webhook = await db.collection("webhooks").findOne({ slug, userId });
    if (!webhook) return [];

    const docs = await db
      .collection("logs")
      .find({ webhookSlug: slug })
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();

    return docs.map((doc) => ({
      _id: doc._id.toString(),
      webhookSlug: doc.webhookSlug,
      method: doc.method,
      headers: doc.headers || {},
      query: doc.query || {},
      body: doc.body || "",
      clientIp: doc.clientIp || "",
      timestamp: doc.timestamp,
      emailNotified: doc.emailNotified,
      emailError: doc.emailError,
      slackNotified: doc.slackNotified,
      discordNotified: doc.discordNotified,
      pagerDutyNotified: doc.pagerDutyNotified,
      forwardedUrl: doc.forwardedUrl,
      forwardStatus: doc.forwardStatus,
      forwardResponse: doc.forwardResponse,
      deliveries: doc.deliveries || [],
      isDuplicate: doc.isDuplicate,
      idempotencyKeyUsed: doc.idempotencyKeyUsed,
      transformedBody: doc.transformedBody,
      delayAppliedMs: doc.delayAppliedMs,
      deliveryStatus: doc.deliveryStatus,
      responseStatus: doc.responseStatus,
      responseBody: doc.responseBody,
      responseContentType: doc.responseContentType,
      hmacVerified: doc.hmacVerified,
      hmacError: doc.hmacError,
      schemaError: doc.schemaError,
      isFiltered: doc.isFiltered,
      filterReason: doc.filterReason,
      connectorResults: doc.connectorResults,
      asymmetricSigned: doc.asymmetricSigned,
      asymmetricSignature: doc.asymmetricSignature,
      authError: doc.authError,
      ttlExpired: doc.ttlExpired,
      ttlReason: doc.ttlReason,
    })) as WebhookRequestLog[];
  } catch (e) {
    console.error("Error fetching request logs", e);
    return [];
  }
}

/**
 * Deletes a dynamic webhook and all of its associated logs
 */
export async function deleteWebhook(slug: string) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { error: "Unauthorized. Please sign in." };
    }

    const db = await getDb();

    const webhook = await db.collection("webhooks").findOne({ slug, userId });
    if (!webhook) {
      return { error: "Webhook not found or access denied." };
    }

    await Promise.all([
      db.collection("webhooks").deleteOne({ slug, userId }),
      db.collection("logs").deleteMany({ webhookSlug: slug }),
    ]);

    revalidatePath("/");
    return { data: "Webhook and its logs deleted successfully." };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Failed to delete webhook." };
  }
}

/**
 * Clears request logs for a specific webhook slug
 */
export async function clearWebhookLogs(slug: string) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { error: "Unauthorized. Please sign in." };
    }

    const db = await getDb();

    const webhook = await db.collection("webhooks").findOne({ slug, userId });
    if (!webhook) {
      return { error: "Webhook not found or access denied." };
    }

    await db.collection("logs").deleteMany({ webhookSlug: slug });
    revalidatePath("/");
    return { data: "Logs cleared successfully." };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Failed to clear logs." };
  }
}

/**
 * Fetches dynamic dashboard analytics for the authenticated user
 */
export async function getDashboardAnalytics() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return {
        totalEndpoints: 0,
        totalLogs: 0,
        errors: 0,
        successes: 0,
      };
    }

    const db = await getDb();

    const userWebhooks = await db.collection("webhooks").find({ userId }).toArray();
    const userSlugs = userWebhooks.map((w) => w.slug);

    const totalEndpoints = userWebhooks.length;

    if (totalEndpoints === 0) {
      return {
        totalEndpoints: 0,
        totalLogs: 0,
        errors: 0,
        successes: 0,
      };
    }

    const totalLogs = await db.collection("logs").countDocuments({ webhookSlug: { $in: userSlugs } });

    const logs = await db.collection("logs")
      .find({ webhookSlug: { $in: userSlugs } })
      .project({ status: 1 })
      .toArray();

    const statusCodes = logs.map((l) => l.status).filter(Boolean);
    const errors = statusCodes.filter((c) => c >= 400).length;
    const successes = statusCodes.filter((c) => c >= 200 && c < 300).length;

    return {
      totalEndpoints,
      totalLogs,
      errors,
      successes,
    };
  } catch (e) {
    console.error("Error running aggregations on MongoDB", e);
    return {
      totalEndpoints: 0,
      totalLogs: 0,
      errors: 0,
      successes: 0,
    };
  }
}

/**
 * Helper to perform an artificial sleep / delay
 */
export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Forwards a request to forwardUrl with exponential backoff retries.
 * Signs request with private key if asymmetric signing is enabled.
 */
export async function forwardWebhookRequest(
  logId: string,
  forwardUrl: string,
  method: string,
  headers: Record<string, string>,
  body: string,
  maxRetries = 3,
  asymmetricConfig?: { privateKey: string; keyType: "ed25519" | "rsa"; publicKey: string }
): Promise<{ success: boolean; lastStatus?: number; lastError?: string; attempts: DeliveryAttempt[] }> {
  const attempts: DeliveryAttempt[] = [];
  let success = false;
  let lastStatus: number | undefined;
  let lastError: string | undefined;

  const headersToIgnore = [
    "host",
    "connection",
    "content-length",
    "accept-encoding",
    "x-forwarded-for",
    "x-forwarded-host",
    "x-forwarded-proto",
    "x-forwarded-port",
    "x-forwarded-server",
    "clerk-db-bootstrap"
  ];
  const cleanHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!headersToIgnore.includes(key.toLowerCase())) {
      cleanHeaders[key] = value;
    }
  }

  // Calculate Asymmetric Key Signature if enabled
  let asymmetricSig: string | undefined = undefined;
  if (asymmetricConfig?.privateKey) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payloadToSign = `${timestamp}.${body}`;
    try {
      asymmetricSig = signAsymmetricPayload(payloadToSign, asymmetricConfig.privateKey, asymmetricConfig.keyType);
      cleanHeaders["X-Webhook-Signature-Timestamp"] = timestamp;
      cleanHeaders["X-Webhook-Signature-Type"] = asymmetricConfig.keyType;
      cleanHeaders[`X-Webhook-Signature-${asymmetricConfig.keyType.toUpperCase()}`] = asymmetricSig;
    } catch (sigErr) {
      console.error("Failed to generate asymmetric signature", sigErr);
    }
  }

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const attemptTime = new Date().toISOString();
    try {
      if (attempt > 1) {
        const delay = 100 * Math.pow(3, attempt - 2);
        await sleep(delay);
      }

      const res = await fetch(forwardUrl, {
        method,
        headers: cleanHeaders,
        body: method !== "GET" && method !== "HEAD" ? body : undefined,
        signal: AbortSignal.timeout(5000),
      });

      lastStatus = res.status;
      const text = await res.text();
      const isOk = res.status >= 200 && res.status < 300;

      attempts.push({
        attempt,
        timestamp: attemptTime,
        status: isOk ? "SUCCESS" : "FAILED",
        statusCode: res.status,
        error: isOk ? undefined : `Status code ${res.status}: ${text.substring(0, 100)}`,
      });

      if (isOk) {
        success = true;
        break;
      } else {
        lastError = `Status ${res.status}`;
      }
    } catch (err: any) {
      lastError = err.message || "Fetch failed";
      attempts.push({
        attempt,
        timestamp: attemptTime,
        status: "FAILED",
        error: lastError,
      });
    }
  }

  try {
    const db = await getDb();
    const deliveryStatus = success ? "SUCCESS" : "DLQ";

    await db.collection("logs").updateOne(
      { _id: new ObjectId(logId) },
      {
        $set: {
          forwardedUrl: forwardUrl,
          forwardStatus: lastStatus,
          forwardResponse: attempts[attempts.length - 1]?.error || "Success",
          deliveries: attempts,
          deliveryStatus,
          asymmetricSigned: Boolean(asymmetricSig),
          asymmetricSignature: asymmetricSig,
        },
      }
    );
  } catch (dbErr) {
    console.error("Failed to update forward logs in DB", dbErr);
  }

  return { success, lastStatus, lastError, attempts };
}

/**
 * Retrieves all DLQ logs for the authenticated user's webhooks.
 */
export async function getDLQLogs(): Promise<WebhookRequestLog[]> {
  try {
    const { userId } = await auth();
    if (!userId) return [];

    const db = await getDb();

    const userWebhooks = await db.collection("webhooks").find({ userId }).toArray();
    const userSlugs = userWebhooks.map((w) => w.slug);

    if (userSlugs.length === 0) return [];

    const docs = await db
      .collection("logs")
      .find({ webhookSlug: { $in: userSlugs }, deliveryStatus: "DLQ" })
      .sort({ timestamp: -1 })
      .toArray();

    return docs.map((doc) => ({
      _id: doc._id.toString(),
      webhookSlug: doc.webhookSlug,
      method: doc.method,
      headers: doc.headers || {},
      query: doc.query || {},
      body: doc.body || "",
      clientIp: doc.clientIp || "",
      timestamp: doc.timestamp,
      emailNotified: doc.emailNotified,
      emailError: doc.emailError,
      forwardedUrl: doc.forwardedUrl,
      forwardStatus: doc.forwardStatus,
      forwardResponse: doc.forwardResponse,
      deliveries: doc.deliveries || [],
      deliveryStatus: doc.deliveryStatus,
    })) as WebhookRequestLog[];
  } catch (e) {
    console.error("Error fetching DLQ logs", e);
    return [];
  }
}

/**
 * Manually re-drives/replays a DLQ request log to its configured forwardUrl.
 */
export async function redriveDLQPayload(logId: string) {
  try {
    const { userId } = await auth();
    if (!userId) return { error: "Unauthorized. Please sign in." };

    const db = await getDb();

    const log = await db.collection("logs").findOne({ _id: new ObjectId(logId) });
    if (!log) return { error: "Log entry not found." };

    const webhook = await db.collection("webhooks").findOne({ slug: log.webhookSlug, userId });
    if (!webhook) return { error: "Webhook not found or access denied." };

    const forwardUrl = webhook.forwardUrl;
    if (!forwardUrl) return { error: "No forward URL configured for this webhook." };

    await db.collection("logs").updateOne(
      { _id: new ObjectId(logId) },
      { $set: { deliveryStatus: "PENDING" } }
    );

    const maxRetries = webhook.retryCount !== undefined ? webhook.retryCount : 3;

    const asymmetricConfig = webhook.asymmetricSigningEnabled && webhook.privateKey
      ? { privateKey: webhook.privateKey, keyType: webhook.asymmetricKeyType || "ed25519", publicKey: webhook.publicKey || "" }
      : undefined;

    const result = await forwardWebhookRequest(
      logId,
      forwardUrl,
      log.method,
      log.headers,
      log.transformedBody || log.body,
      maxRetries,
      asymmetricConfig
    );

    revalidatePath("/");

    if (result.success) {
      return { data: "Re-drive successful!" };
    } else {
      return { error: `Re-drive attempt failed: ${result.lastError}` };
    }
  } catch (e: any) {
    console.error("Error running re-drive", e);
    return { error: e.message || "Failed to execute re-drive" };
  }
}

/**
 * Deletes a list of dynamic webhooks and all associated logs in bulk.
 */
export async function deleteWebhooksBatch(slugs: string[]) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { error: "Unauthorized. Please sign in." };
    }

    const db = await getDb();

    const userWebhooks = await db
      .collection("webhooks")
      .find({ slug: { $in: slugs }, userId })
      .toArray();

    const allowedSlugs = userWebhooks.map((w) => w.slug);
    if (allowedSlugs.length === 0) {
      return { error: "No matching webhooks found or access denied." };
    }

    await Promise.all([
      db.collection("webhooks").deleteMany({ slug: { $in: allowedSlugs }, userId }),
      db.collection("logs").deleteMany({ webhookSlug: { $in: allowedSlugs } }),
    ]);

    revalidatePath("/");
    return { data: `Successfully deleted ${allowedSlugs.length} endpoints.` };
  } catch (e: any) {
    return { error: e.message || "Failed to bulk delete webhooks." };
  }
}

/**
 * Returns webhook configurations in JSON format for backup or migration.
 */
export async function exportWebhooksBatch(slugs: string[]): Promise<WebhookDefinition[]> {
  try {
    const { userId } = await auth();
    if (!userId) return [];

    const db = await getDb();

    const docs = await db
      .collection("webhooks")
      .find({ slug: { $in: slugs }, userId })
      .toArray();

    return docs.map((doc) => serializeWebhook(doc as Record<string, unknown>));
  } catch (e) {
    console.error("Failed to export webhooks", e);
    return [];
  }
}

/**
 * Updates response status codes for webhooks in bulk.
 */
export async function updateWebhooksStatusBatch(slugs: string[], status: number) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { error: "Unauthorized. Please sign in." };
    }

    const db = await getDb();

    const userWebhooks = await db
      .collection("webhooks")
      .find({ slug: { $in: slugs }, userId })
      .toArray();

    const allowedSlugs = userWebhooks.map((w) => w.slug);
    if (allowedSlugs.length === 0) {
      return { error: "No matching webhooks found or access denied." };
    }

    await db.collection("webhooks").updateMany(
      { slug: { $in: allowedSlugs }, userId },
      { $set: { status } }
    );

    revalidatePath("/");
    return { data: `Updated status to ${status} for ${allowedSlugs.length} endpoints.` };
  } catch (e: any) {
    return { error: e.message || "Failed to update webhooks status." };
  }
}

// --- WHITE-LABEL CUSTOMER PORTAL SERVER ACTIONS ---

/**
 * Public/Unauthenticated or token-based Portal endpoint fetcher
 */
export async function getPortalWebhookDetails(slug: string): Promise<WebhookDefinition | null> {
  if (!slug) return null;
  try {
    const db = await getDb();
    const doc = await db.collection("webhooks").findOne({ slug });
    if (!doc) return null;
    const serialized = serializeWebhook(doc as Record<string, unknown>);
    // Hide sensitive credentials for white-label view
    serialized.privateKey = undefined;
    serialized.basicAuthPassword = serialized.basicAuthPassword ? "[PROTECTED]" : undefined;
    return serialized;
  } catch (e) {
    console.error("Error fetching portal webhook details", e);
    return null;
  }
}

/**
 * Fetch logs for white-label portal view
 */
export async function getPortalWebhookLogs(slug: string): Promise<WebhookRequestLog[]> {
  if (!slug) return [];
  try {
    const db = await getDb();
    const docs = await db
      .collection("logs")
      .find({ webhookSlug: slug })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();

    return docs.map((doc) => ({
      _id: doc._id.toString(),
      webhookSlug: doc.webhookSlug,
      method: doc.method,
      headers: doc.headers || {},
      query: doc.query || {},
      body: doc.body || "",
      clientIp: doc.clientIp || "",
      timestamp: doc.timestamp,
      forwardedUrl: doc.forwardedUrl,
      forwardStatus: doc.forwardStatus,
      forwardResponse: doc.forwardResponse,
      deliveries: doc.deliveries || [],
      deliveryStatus: doc.deliveryStatus,
      connectorResults: doc.connectorResults,
      asymmetricSigned: doc.asymmetricSigned,
      asymmetricSignature: doc.asymmetricSignature,
    })) as WebhookRequestLog[];
  } catch (e) {
    console.error("Error fetching portal logs", e);
    return [];
  }
}

/**
 * Re-drive DLQ delivery from white-label portal
 */
export async function redrivePortalWebhookLog(slug: string, logId: string) {
  try {
    const db = await getDb();
    const log = await db.collection("logs").findOne({ _id: new ObjectId(logId), webhookSlug: slug });
    if (!log) return { error: "Log entry not found." };

    const webhook = await db.collection("webhooks").findOne({ slug });
    if (!webhook) return { error: "Webhook not found." };

    const forwardUrl = webhook.forwardUrl;
    if (!forwardUrl) return { error: "No forward URL configured for this webhook." };

    await db.collection("logs").updateOne(
      { _id: new ObjectId(logId) },
      { $set: { deliveryStatus: "PENDING" } }
    );

    const maxRetries = webhook.retryCount !== undefined ? webhook.retryCount : 3;

    const asymmetricConfig = webhook.asymmetricSigningEnabled && webhook.privateKey
      ? { privateKey: webhook.privateKey, keyType: webhook.asymmetricKeyType || "ed25519", publicKey: webhook.publicKey || "" }
      : undefined;

    const result = await forwardWebhookRequest(
      logId,
      forwardUrl,
      log.method,
      log.headers,
      log.transformedBody || log.body,
      maxRetries,
      asymmetricConfig
    );

    if (result.success) {
      return { data: "Re-drive successful!" };
    } else {
      return { error: `Re-drive attempt failed: ${result.lastError}` };
    }
  } catch (e: any) {
    return { error: e.message || "Re-drive failed" };
  }
}
