import type { Db } from "mongodb";

const DEFAULT_LIMIT = 120;
const WINDOW_MS = 60_000;

type RateLimitDoc = {
  key: string;
  count: number;
  expiresAt: Date;
};

/**
 * Fixed-window rate limit per webhook slug (Mongo-backed for serverless).
 */
export async function assertWebhookRateLimit(db: Db, slug: string): Promise<{
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSec: number;
}> {
  const limit = Number.parseInt(process.env.WEBHOOK_RATE_LIMIT_PER_MINUTE || "", 10);
  const max = Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT;

  const now = Date.now();
  const windowId = Math.floor(now / WINDOW_MS);
  const key = `${slug}:${windowId}`;
  const expiresAt = new Date((windowId + 2) * WINDOW_MS);

  const collection = db.collection<RateLimitDoc>("rate_limits");
  let result: RateLimitDoc | null = null;

  try {
    result = await collection.findOneAndUpdate(
      { key },
      {
        $inc: { count: 1 },
        $setOnInsert: { key, expiresAt },
      },
      { upsert: true, returnDocument: "after" }
    );
  } catch (err: unknown) {
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? (err as { code?: number }).code
        : undefined;
    if (code !== 11000) throw err;
    result = await collection.findOneAndUpdate(
      { key },
      { $inc: { count: 1 } },
      { returnDocument: "after" }
    );
  }

  const count = result?.count ?? 1;
  const allowed = count <= max;
  const remaining = Math.max(0, max - count);
  const retryAfterSec = Math.max(1, Math.ceil(((windowId + 1) * WINDOW_MS - now) / 1000));

  return { allowed, limit: max, remaining, retryAfterSec };
}
