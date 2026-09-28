import type { NextRequest } from "next/server";
import { subscribeWebhookEvent } from "./pubsub";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected", slug })}\n\n`)
      );

      // Keepalive interval
      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepAliveInterval);
        }
      }, 15000);

      // Subscribe to real-time events for this slug
      const unsubscribe = subscribeWebhookEvent(slug, (payload) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "webhook_event", payload })}\n\n`)
          );
        } catch {
          unsubscribe();
          clearInterval(keepAliveInterval);
        }
      });

      request.signal.addEventListener("abort", () => {
        unsubscribe();
        clearInterval(keepAliveInterval);
        try {
          controller.close();
        } catch {
          // Stream already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
