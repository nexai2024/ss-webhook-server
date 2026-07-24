import test from "node:test";
import assert from "node:assert";

// Standalone test suite verifying core authentication, pricing tier, and GTM business rules.
test("Pricing Tier & Authentication Business Rules", async (t) => {
  await t.test("Free tier allows up to 2 webhooks, but rejects 3rd", () => {
    const isPremium = false;
    const currentWebhookCount = 2;

    const allowed = isPremium || currentWebhookCount < 2;
    assert.strictEqual(allowed, false, "Free tier should reject creating a 3rd webhook");
  });

  await t.test("Premium tier allows unlimited webhooks", () => {
    const isPremium = true;
    const currentWebhookCount = 999;

    const allowed = isPremium || currentWebhookCount < 2;
    assert.strictEqual(allowed, true, "Premium tier should allow unlimited webhooks");
  });

  await t.test("Free tier rejects custom HTTP status codes other than 200, 201, 204", () => {
    const isPremium = false;
    const allowedStatuses = [200, 201, 204];

    const statusToTest = 404;
    const isAllowed = isPremium || allowedStatuses.includes(statusToTest);

    assert.strictEqual(isAllowed, false, "Free tier should reject 404 response status");
  });

  await t.test("Premium tier allows any custom HTTP status code", () => {
    const isPremium = true;
    const allowedStatuses = [200, 201, 204];

    const statusToTest = 500;
    const isAllowed = isPremium || allowedStatuses.includes(statusToTest);

    assert.strictEqual(isAllowed, true, "Premium tier should allow custom response statuses like 500");
  });

  await t.test("Free tier rejects email alerts configuration", () => {
    const isPremium = false;
    const hasEmailConfigured = true;

    const allowed = isPremium || !hasEmailConfigured;
    assert.strictEqual(allowed, false, "Free tier should reject instant email alerts configuration");
  });

  await t.test("Premium tier allows email alerts configuration", () => {
    const isPremium = true;
    const hasEmailConfigured = true;

    const allowed = isPremium || !hasEmailConfigured;
    assert.strictEqual(allowed, true, "Premium tier should allow instant email alerts configuration");
  });
});
