import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { getDb } from "../../../lib/db";

/**
 * Clerk Billing (+ auth) lifecycle webhooks.
 * Register this URL in Clerk Dashboard → Webhooks:
 *   https://<your-domain>/api/clerk/webhooks
 * Subscribe to subscription.* and subscriptionItem.* events.
 */
export async function POST(req: NextRequest) {
  let evt: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    console.error("Clerk webhook verification failed:", err);
    return new Response("Verification failed", { status: 400 });
  }

  try {
    const db = await getDb();
    const receivedAt = new Date();

    if (
      evt.type === "subscription.created" ||
      evt.type === "subscription.updated" ||
      evt.type === "subscription.active" ||
      evt.type === "subscription.pastDue"
    ) {
      const data = evt.data as {
        id: string;
        status?: string;
        payer?: { user_id?: string; organization_id?: string };
        items?: Array<{ plan?: { slug?: string } }>;
      };

      const entityId = data.payer?.organization_id ?? data.payer?.user_id;
      const plan = data.items?.[0]?.plan?.slug;

      await db.collection("subscriptions").updateOne(
        { subscriptionId: data.id },
        {
          $set: {
            subscriptionId: data.id,
            entityId: entityId ?? null,
            plan: plan ?? null,
            status: data.status ?? evt.type,
            eventType: evt.type,
            updatedAt: receivedAt,
          },
          $setOnInsert: { createdAt: receivedAt },
        },
        { upsert: true }
      );
    }

    if (
      evt.type === "subscriptionItem.canceled" ||
      evt.type === "subscriptionItem.ended" ||
      evt.type === "subscriptionItem.pastDue" ||
      evt.type === "subscriptionItem.active"
    ) {
      const data = evt.data as {
        id: string;
        status?: string;
        payer?: { user_id?: string; organization_id?: string };
        plan?: { slug?: string };
      };

      const entityId = data.payer?.organization_id ?? data.payer?.user_id;

      await db.collection("subscription_events").insertOne({
        itemId: data.id,
        entityId: entityId ?? null,
        plan: data.plan?.slug ?? null,
        status: data.status ?? evt.type,
        eventType: evt.type,
        createdAt: receivedAt,
      });

      if (entityId && (evt.type === "subscriptionItem.canceled" || evt.type === "subscriptionItem.ended")) {
        await db.collection("subscriptions").updateOne(
          { entityId, plan: data.plan?.slug },
          {
            $set: {
              status: evt.type === "subscriptionItem.canceled" ? "canceled" : "ended",
              updatedAt: receivedAt,
            },
          }
        );
      }
    }

    console.log(`Clerk webhook handled: ${evt.type}`);
  } catch (err) {
    console.error("Clerk webhook handler error:", err);
    // Still 200 after verify — avoid infinite Svix retries for app bugs
  }

  return new Response("OK", { status: 200 });
}
