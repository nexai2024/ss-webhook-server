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

    const eventType = evt.type as string;

    if (
      eventType === "subscription.created" ||
      eventType === "subscription.updated" ||
      eventType === "subscription.active" ||
      eventType === "subscription.pastDue" ||
      eventType === "subscription.canceled" ||
      eventType === "subscription.deleted"
    ) {
      const data = evt.data as unknown as {
        id: string;
        status?: string;
        payer?: { user_id?: string; organization_id?: string };
        items?: Array<{ plan?: { slug?: string } }>;
      };

      const entityId = data.payer?.organization_id ?? data.payer?.user_id;
      const plan = data.items?.[0]?.plan?.slug;
      const isCanceled = eventType === "subscription.canceled" || eventType === "subscription.deleted";

      await db.collection("subscriptions").updateOne(
        { subscriptionId: data.id },
        {
          $set: {
            subscriptionId: data.id,
            entityId: entityId ?? null,
            plan: plan ?? null,
            status: isCanceled ? "canceled" : (data.status ?? eventType),
            eventType,
            updatedAt: receivedAt,
          },
          $setOnInsert: { createdAt: receivedAt },
        },
        { upsert: true }
      );
    }

    if (
      eventType === "subscriptionItem.canceled" ||
      eventType === "subscriptionItem.ended" ||
      eventType === "subscriptionItem.deleted" ||
      eventType === "subscriptionItem.pastDue" ||
      eventType === "subscriptionItem.active"
    ) {
      const data = evt.data as unknown as {
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
        status: data.status ?? eventType,
        eventType,
        createdAt: receivedAt,
      });

      if (entityId && (eventType === "subscriptionItem.canceled" || eventType === "subscriptionItem.ended" || eventType === "subscriptionItem.deleted")) {
        await db.collection("subscriptions").updateOne(
          { entityId, plan: data.plan?.slug },
          {
            $set: {
              status: "canceled",
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
