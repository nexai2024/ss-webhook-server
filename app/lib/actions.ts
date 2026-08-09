"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";

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
  createdAt: string;
  forwardUrl?: string;
  retryCount?: number;
  transformScript?: string;
  cronSchedule?: string;
  delayMs?: number;
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
}

export interface UserTierInfo {
  isPremium: boolean;
  activePlan: string;
  endpointsCount: number;
}

export type WebhookState = { error: string } | { data: WebhookDefinition };

/**
 * Gets the current user's subscription tier and usage statistics
 */
export async function getUserTier(): Promise<UserTierInfo> {
  try {
    const { userId, has } = await auth();
    if (!userId) {
      return { isPremium: false, activePlan: "Guest", endpointsCount: 0 };
    }

    const db = await getDb();
    const count = await db.collection("webhooks").countDocuments({ userId });
    const entitlements = getEntitlements(has);

    return {
      isPremium:
        entitlements.isPremium ||
        entitlements.canCreateUnlimitedEndpoints ||
        entitlements.canUseEmailAlerts,
      activePlan: entitlements.activePlan,
      endpointsCount: count,
    };
  } catch (e) {
    console.error("Error fetching user tier info", e);
    return { isPremium: false, activePlan: "Cloud Free", endpointsCount: 0 };
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
    const body = (formData.get("body") as string) || "{\"status\": \"success\"}";
    const notifyEmail = (formData.get("notifyEmail") as string) || "";
    const forwardUrl = (formData.get("forwardUrl") as string) || "";
    const retryCountStr = (formData.get("retryCount") as string) || "3";
    const transformScript = (formData.get("transformScript") as string) || "";
    const cronSchedule = (formData.get("cronSchedule") as string) || "";
    const delayMsStr = (formData.get("delayMs") as string) || "0";

    const status = Number.parseInt(statusStr, 10) || 200;
    const retryCount = Number.parseInt(retryCountStr, 10) || 3;
    const delayMs = Number.parseInt(delayMsStr, 10) || 0;
    const isPremium = has({ plan: "premium" }) || has({ feature: "email_alerts" });

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
      forwardUrl: forwardUrl.trim() || undefined,
      retryCount: forwardUrl.trim() ? retryCount : undefined,
      transformScript: transformScript.trim() || undefined,
      cronSchedule: cronSchedule.trim() || undefined,
      delayMs: delayMs > 0 ? delayMs : undefined,
      createdAt: new Date().toISOString(),
    };

    try {
      await db.collection("webhooks").insertOne(newWebhook);
    } catch (insertErr: unknown) {
      // Unique index race
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

    revalidatePath("/");
    return { data: newWebhook as WebhookDefinition };
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
    const { userId } = await auth();
    if (!userId) return [];

    const db = await getDb();
    const docs = await db
      .collection("webhooks")
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();

    return docs.map((doc) => ({
      _id: doc._id.toString(),
      userId: doc.userId,
      name: doc.name,
      slug: doc.slug,
      method: doc.method,
      status: doc.status,
      contentType: doc.contentType,
      body: doc.body,
      notifyEmail: doc.notifyEmail,
      createdAt: doc.createdAt,
    })) as WebhookDefinition[];
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

    // Enforce ownership check before fetching logs
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

    // Check ownership
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

    // Check ownership
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

    // Find all webhooks for this user
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

    // Find logs for those webhooks only
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
 * Updates the log document in MongoDB.
 */
export async function forwardWebhookRequest(
  logId: string,
  forwardUrl: string,
  method: string,
  headers: Record<string, string>,
  body: string,
  maxRetries = 3
): Promise<{ success: boolean; lastStatus?: number; lastError?: string; attempts: DeliveryAttempt[] }> {
  const attempts: DeliveryAttempt[] = [];
  let success = false;
  let lastStatus: number | undefined;
  let lastError: string | undefined;

  // Filter headers
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

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const attemptTime = new Date().toISOString();
    try {
      // Small delay for backoff (exponential: 100ms, 300ms, 900ms)
      if (attempt > 1) {
        const delay = 100 * Math.pow(3, attempt - 2);
        await sleep(delay);
      }

      const res = await fetch(forwardUrl, {
        method,
        headers: cleanHeaders,
        body: method !== "GET" && method !== "HEAD" ? body : undefined,
        // Short timeout
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

  // Update DB
  try {
    const client = await clientPromise;
    const db = client.db("dynamic-webhook-app");
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

    const client = await clientPromise;
    const db = client.db("dynamic-webhook-app");

    // Get user's webhooks slugs
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

    const client = await clientPromise;
    const db = client.db("dynamic-webhook-app");

    // Fetch the log
    const log = await db.collection("logs").findOne({ _id: new ObjectId(logId) });
    if (!log) return { error: "Log entry not found." };

    // Verify ownership of the webhook
    const webhook = await db.collection("webhooks").findOne({ slug: log.webhookSlug, userId });
    if (!webhook) return { error: "Webhook not found or access denied." };

    const forwardUrl = webhook.forwardUrl;
    if (!forwardUrl) return { error: "No forward URL configured for this webhook." };

    // Reset status to pending before retrying
    await db.collection("logs").updateOne(
      { _id: new ObjectId(logId) },
      { $set: { deliveryStatus: "PENDING" } }
    );

    const maxRetries = webhook.retryCount !== undefined ? webhook.retryCount : 3;

    // Trigger forwarding attempt
    const result = await forwardWebhookRequest(
      logId,
      forwardUrl,
      log.method,
      log.headers,
      log.transformedBody || log.body,
      maxRetries
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

    const client = await clientPromise;
    const db = client.db("dynamic-webhook-app");

    // Check ownership for all requested slugs
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

    const client = await clientPromise;
    const db = client.db("dynamic-webhook-app");

    // Fetch and verify ownership
    const docs = await db
      .collection("webhooks")
      .find({ slug: { $in: slugs }, userId })
      .toArray();

    return docs.map((doc) => ({
      _id: doc._id.toString(),
      userId: doc.userId,
      name: doc.name,
      slug: doc.slug,
      method: doc.method,
      status: doc.status,
      contentType: doc.contentType,
      body: doc.body,
      notifyEmail: doc.notifyEmail,
      forwardUrl: doc.forwardUrl,
      retryCount: doc.retryCount,
      transformScript: doc.transformScript,
      cronSchedule: doc.cronSchedule,
      delayMs: doc.delayMs,
      createdAt: doc.createdAt,
    })) as WebhookDefinition[];
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

    const client = await clientPromise;
    const db = client.db("dynamic-webhook-app");

    // Find and verify ownership
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
