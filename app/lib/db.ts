import type { Db } from "mongodb";
import clientPromise from "./mongodb";

const DB_NAME = "dynamic-webhook-app";

let indexesPromise: Promise<void> | null = null;

/**
 * Returns the app database and ensures indexes exist (once per process).
 */
export async function getDb(): Promise<Db> {
  if (!process.env.MONGODB_URI && process.env.NODE_ENV === "production") {
    throw new Error("MONGODB_URI must be set in production");
  }

  const client = await clientPromise;
  const db = client.db(DB_NAME);
  if (!indexesPromise) {
    indexesPromise = ensureIndexes(db).catch((err) => {
      indexesPromise = null;
      console.error("Failed to ensure MongoDB indexes", err);
      throw err;
    });
  }
  await indexesPromise;
  return db;
}

async function ensureIndexes(db: Db): Promise<void> {
  const retentionDays = Number.parseInt(process.env.LOG_RETENTION_DAYS || "30", 10);
  const expireAfterSeconds =
    Number.isFinite(retentionDays) && retentionDays > 0
      ? retentionDays * 24 * 60 * 60
      : 30 * 24 * 60 * 60;

  await Promise.all([
    db.collection("webhooks").createIndex({ slug: 1 }, { unique: true, name: "webhooks_slug_unique" }),
    db.collection("webhooks").createIndex({ userId: 1 }, { name: "webhooks_userId" }),
    db.collection("logs").createIndex(
      { webhookSlug: 1, timestamp: -1 },
      { name: "logs_slug_timestamp" }
    ),
    // TTL requires a BSON Date field — see createdAt on log inserts
    db.collection("logs").createIndex(
      { createdAt: 1 },
      { expireAfterSeconds, name: "logs_createdAt_ttl" }
    ),
    db.collection("rate_limits").createIndex({ key: 1 }, { unique: true, name: "rate_limits_key_unique" }),
    db.collection("rate_limits").createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: "rate_limits_ttl" }
    ),
    db.collection("subscriptions").createIndex(
      { subscriptionId: 1 },
      { unique: true, name: "subscriptions_id_unique" }
    ),
    db.collection("subscriptions").createIndex({ entityId: 1 }, { name: "subscriptions_entityId" }),
  ]);
}
