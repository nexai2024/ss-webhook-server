import { describe, it, expect, vi } from "vitest";
import { getEntitlements, isUserPremium, BILLING } from "./billing";
import { assertWebhookRateLimit } from "./rate-limit";

describe("Billing & Entitlements", () => {
  it("should evaluate Cloud Free entitlements correctly when has is false/null", () => {
    const entitlements = getEntitlements(null);
    expect(entitlements.isPremium).toBe(false);
    expect(entitlements.canCreateUnlimitedEndpoints).toBe(false);
    expect(entitlements.canUseEmailAlerts).toBe(false);
    expect(entitlements.canUseCustomStatus).toBe(false);
    expect(entitlements.activePlan).toBe("Cloud Free");
  });

  it("should evaluate Cloud Premium entitlements when has returns plan match", () => {
    const has = vi.fn().mockImplementation((arg) => arg.plan === BILLING.plan);
    const entitlements = getEntitlements(has);
    expect(entitlements.isPremium).toBe(true);
    expect(entitlements.canCreateUnlimitedEndpoints).toBe(true);
    expect(entitlements.activePlan).toBe("Cloud Premium");
  });

  it("should check isUserPremium using session has function or db lookup", async () => {
    const mockFindOne = vi.fn().mockResolvedValue({
      entityId: "user_123",
      plan: BILLING.plan,
      status: "active",
    });
    const mockDb = {
      collection: vi.fn().mockReturnValue({ findOne: mockFindOne }),
    } as any;

    const hasPremium = vi.fn().mockImplementation((arg) => arg.plan === BILLING.plan);
    const resHas = await isUserPremium(mockDb, "user_123", hasPremium);
    expect(resHas).toBe(true);

    const hasFree = vi.fn().mockReturnValue(false);
    const resDb = await isUserPremium(mockDb, "user_123", hasFree);
    expect(resDb).toBe(true);
    expect(mockDb.collection).toHaveBeenCalledWith("subscriptions");
  });

  it("should enforce tier rate limits per minute", async () => {
    const mockFindOneAndUpdate = vi.fn().mockResolvedValue({ count: 1 });
    const mockDb = {
      collection: vi.fn().mockReturnValue({ findOneAndUpdate: mockFindOneAndUpdate }),
    } as any;

    const freeLimit = await assertWebhookRateLimit(mockDb, "test-slug", false);
    expect(freeLimit.limit).toBe(BILLING.freeRateLimitPerMinute);

    const premiumLimit = await assertWebhookRateLimit(mockDb, "test-slug", true);
    expect(premiumLimit.limit).toBe(BILLING.premiumRateLimitPerMinute);
  });
});
