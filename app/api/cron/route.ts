import { NextResponse } from "next/server";
import clientPromise from "../../lib/mongodb";
import { forwardWebhookRequest } from "../../lib/actions";

export async function GET(request: Request) {
  try {
    const client = await clientPromise;
    const db = client.db("dynamic-webhook-app");

    // Find all webhooks with a non-empty cronSchedule
    const scheduledWebhooks = await db
      .collection("webhooks")
      .find({ cronSchedule: { $exists: true, $ne: "" } })
      .toArray();

    const triggered = [];

    for (const webhook of scheduledWebhooks) {
      const timestamp = new Date().toISOString();
      const slug = webhook.slug;

      // Simulate cron trigger payload
      const cronPayload = JSON.stringify({
        event: "cron_trigger",
        schedule: webhook.cronSchedule,
        timestamp,
      });

      // Insert log
      const logResult = await db.collection("logs").insertOne({
        webhookSlug: slug,
        method: "CRON",
        headers: { "user-agent": "EndpointHub-Cron-Scheduler" },
        query: {},
        body: cronPayload,
        clientIp: "127.0.0.1",
        timestamp,
        status: webhook.status,
        emailNotified: false,
        deliveryStatus: webhook.forwardUrl ? "PENDING" : "NONE",
      });

      const logId = logResult.insertedId.toString();

      // Trigger forwarding if configured
      if (webhook.forwardUrl) {
        const maxRetries = webhook.retryCount !== undefined ? Number(webhook.retryCount) : 3;
        await forwardWebhookRequest(
          logId,
          webhook.forwardUrl,
          "POST",
          { "content-type": "application/json" },
          cronPayload,
          maxRetries
        );
      }

      triggered.push({
        slug,
        name: webhook.name,
        schedule: webhook.cronSchedule,
        logId,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Triggered ${triggered.length} scheduled webhooks.`,
      triggered,
    });
  } catch (error: any) {
    console.error("Cron execution error:", error);
    return NextResponse.json(
      { error: "Cron execution failed", details: error.message },
      { status: 500 }
    );
  }
}
