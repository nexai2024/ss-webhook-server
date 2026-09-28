import { EventEmitter } from "node:events";

class WebhookPubSub extends EventEmitter {}

// Global pubsub singleton
const globalPubSub = (globalThis as unknown as { __webhookPubSub?: WebhookPubSub }).__webhookPubSub || new WebhookPubSub();
globalPubSub.setMaxListeners(100);
(globalThis as unknown as { __webhookPubSub?: WebhookPubSub }).__webhookPubSub = globalPubSub;

export function broadcastWebhookEvent(slug: string, payload: Record<string, unknown>) {
  globalPubSub.emit(`webhook:${slug}`, payload);
}

export function subscribeWebhookEvent(slug: string, listener: (payload: Record<string, unknown>) => void) {
  const eventName = `webhook:${slug}`;
  globalPubSub.on(eventName, listener);
  return () => {
    globalPubSub.off(eventName, listener);
  };
}
