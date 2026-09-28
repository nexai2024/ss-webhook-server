import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  verifyHmacSignature,
  validateJsonSchema,
  evaluateFilterRules,
  sendSlackAlert,
  sendDiscordAlert,
  sendPagerDutyAlert,
} from "./verification";

describe("Verification Engine", () => {
  describe("HMAC Signature Verification", () => {
    const secret = "whsec_testsecret123";
    const body = JSON.stringify({ event: "checkout.completed", amount: 5000 });

    it("should verify Custom HMAC signature successfully", () => {
      const signature = createHmac("sha256", secret).update(body).digest("hex");
      const res = verifyHmacSignature("custom", secret, body, { "x-signature": signature });
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it("should reject invalid Custom HMAC signature", () => {
      const res = verifyHmacSignature("custom", secret, body, { "x-signature": "bad_signature" });
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Custom HMAC signature mismatch");
    });

    it("should verify Stripe HMAC signature successfully", () => {
      const t = Math.floor(Date.now() / 1000);
      const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
      const header = `t=${t},v1=${v1}`;
      const res = verifyHmacSignature("stripe", secret, body, { "stripe-signature": header });
      expect(res.valid).toBe(true);
    });

    it("should verify GitHub HMAC signature successfully", () => {
      const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
      const res = verifyHmacSignature("github", secret, body, { "x-hub-signature-256": expected });
      expect(res.valid).toBe(true);
    });

    it("should verify Shopify HMAC signature successfully", () => {
      const expected = createHmac("sha256", secret).update(body).digest("base64");
      const res = verifyHmacSignature("shopify", secret, body, { "x-shopify-hmac-sha256": expected });
      expect(res.valid).toBe(true);
    });
  });

  describe("JSON Schema Validation", () => {
    const schema = JSON.stringify({
      required: ["event", "data"],
      properties: {
        event: { type: "string" },
      },
    });

    it("should pass when required fields and property types match", () => {
      const validBody = JSON.stringify({ event: "user.created", data: { id: "123" } });
      const res = validateJsonSchema(schema, validBody);
      expect(res.valid).toBe(true);
    });

    it("should fail when required property is missing", () => {
      const invalidBody = JSON.stringify({ event: "user.created" });
      const res = validateJsonSchema(schema, invalidBody);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Missing required property 'data'");
    });

    it("should fail when property type is wrong", () => {
      const wrongTypeBody = JSON.stringify({ event: 12345, data: {} });
      const res = validateJsonSchema(schema, wrongTypeBody);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("expected type 'string'");
    });
  });

  describe("Conditional Payload Filtering Rules", () => {
    const body = JSON.stringify({ event: "payment.succeeded", amount: 100 });

    it("should match JSON key-value rules", () => {
      const rule = JSON.stringify({ event: "payment.succeeded" });
      const res = evaluateFilterRules(rule, body);
      expect(res.matches).toBe(true);
    });

    it("should reject non-matching JSON rules", () => {
      const rule = JSON.stringify({ event: "payment.failed" });
      const res = evaluateFilterRules(rule, body);
      expect(res.matches).toBe(false);
      expect(res.reason).toContain("expected 'payment.failed'");
    });

    it("should match simple key=value syntax", () => {
      const res = evaluateFilterRules("event=payment.succeeded", body);
      expect(res.matches).toBe(true);
    });

    it("should match substring rules", () => {
      const res = evaluateFilterRules("payment.succeeded", body);
      expect(res.matches).toBe(true);
    });
  });

  describe("Alert Notification Dispatchers", () => {
    it("should dispatch Slack alert", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
      } as Response);

      const ok = await sendSlackAlert("https://hooks.slack.com/test", "Test Alert");
      expect(ok).toBe(true);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://hooks.slack.com/test",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should dispatch Discord alert", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
      } as Response);

      const ok = await sendDiscordAlert("https://discord.com/api/webhooks/test", "Test Alert");
      expect(ok).toBe(true);
    });

    it("should dispatch PagerDuty alert", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
      } as Response);

      const ok = await sendPagerDutyAlert("routing_key_123", "Test Alert");
      expect(ok).toBe(true);
    });
  });
});
