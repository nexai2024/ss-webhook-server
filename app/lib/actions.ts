"use server";

import clientPromise from "./mongodb";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";

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

    const client = await clientPromise;
    const db = client.db("dynamic-webhook-app");
    const count = await db.collection("webhooks").countDocuments({ userId });

    const isPremium = has({ plan: "premium" }) || has({ feature: "email_alerts" });
    return {
      isPremium,
      activePlan: isPremium ? "Premium Plan" : "Free Plan",
      endpointsCount: count,
    };
  } catch (e) {
    console.error("Error fetching user tier info", e);
    return { isPremium: false, activePlan: "Free Plan", endpointsCount: 0 };
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

    const status = Number.parseInt(statusStr, 10) || 200;
    const isPremium = has({ plan: "premium" }) || has({ feature: "email_alerts" });

    const client = await clientPromise;
    const db = client.db("dynamic-webhook-app");

    // Tier 1 restriction: Max 2 webhooks on free tier
    const count = await db.collection("webhooks").countDocuments({ userId });
    if (!isPremium && count >= 2) {
      return {
        error: "Free tier limit reached. You can only create up to 2 webhooks. Please upgrade to Premium."
      };
    }

    // Tier 2 restriction: Email alerts require Premium plan
    if (notifyEmail.trim() && !isPremium) {
      return {
        error: "Instant Email alerts are a Premium feature. Please upgrade your subscription to enable this feature."
      };
    }

    // Tier 3 restriction: Custom HTTP status (other than 200, 201, 204) requires Premium plan
    if (!isPremium && status !== 200 && status !== 201 && status !== 204) {
      return {
        error: "Custom response statuses (other than 200/201/204) require a Premium subscription."
      };
    }

    // Normalize slug: lowercase and hyphenated or auto-generate if empty
    if (!slug) {
      slug = Math.random().toString(36).substring(2, 8);
    } else {
      slug = slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-");
    }

    // Check if slug is already taken globally
    const existing = await db.collection("webhooks").findOne({ slug });
    if (existing) {
      return { error: `The endpoint path '/api/webhooks/${slug}' is already taken. Please choose a different one.` };
    }

    const newWebhook: any = {
      userId,
      name,
      slug,
      method,
      status,
      contentType,
      body,
      notifyEmail: notifyEmail.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    await db.collection("webhooks").insertOne(newWebhook);

    revalidatePath("/");
    return { data: newWebhook as WebhookDefinition };
  } catch (e: any) {
    console.error("Error creating webhook configuration", e);
    return { error: e.message || "An unexpected error occurred." };
  }
}

/**
 * Retrieves all registered dynamic webhooks for the authenticated user
 */
export async function getWebhooks(): Promise<WebhookDefinition[]> {
  try {
    const { userId } = await auth();
    if (!userId) return [];

    const client = await clientPromise;
    const db = client.db("dynamic-webhook-app");
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

    const client = await clientPromise;
    const db = client.db("dynamic-webhook-app");

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

    const client = await clientPromise;
    const db = client.db("dynamic-webhook-app");

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
  } catch (e: any) {
    return { error: e.message || "Failed to delete webhook." };
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

    const client = await clientPromise;
    const db = client.db("dynamic-webhook-app");

    // Check ownership
    const webhook = await db.collection("webhooks").findOne({ slug, userId });
    if (!webhook) {
      return { error: "Webhook not found or access denied." };
    }

    await db.collection("logs").deleteMany({ webhookSlug: slug });
    revalidatePath("/");
    return { data: "Logs cleared successfully." };
  } catch (e: any) {
    return { error: e.message || "Failed to clear logs." };
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

    const client = await clientPromise;
    const db = client.db("dynamic-webhook-app");

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
