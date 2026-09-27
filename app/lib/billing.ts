/**
 * Clerk Billing plan/feature slugs — must match Dashboard → Billing → Plans.
 * Source of truth pulled from the linked Endpoint Builders instance.
 */

export const BILLING = {
  /** Paid user plan slug */
  plan: "cloud_premium",
  features: {
    emailAlerts: "instant_resend_react_email_alerts",
    customStatus: "custom_error_statuses_4xx_5xx_etc_",
    unlimitedEndpoints: "_unlimited_cloud_endpoints",
  },
  /** Free cloud tier endpoint cap when unlimited_endpoints is not entitled */
  freeEndpointLimit: 2,
  /** Allowed response statuses on the free tier */
  freeAllowedStatuses: [200, 201, 204] as const,
  /** Rate limits per minute */
  freeRateLimitPerMinute: 60,
  premiumRateLimitPerMinute: 300,
} as const;

/** Compatible with Clerk `auth().has` without coupling to its overloaded types */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HasFn = (args: any) => boolean;

export type Entitlements = {
  isPremium: boolean;
  canUseEmailAlerts: boolean;
  canUseCustomStatus: boolean;
  canCreateUnlimitedEndpoints: boolean;
  activePlan: string;
};

export function getEntitlements(has?: HasFn | null): Entitlements {
  if (!has) {
    return {
      isPremium: false,
      canUseEmailAlerts: false,
      canUseCustomStatus: false,
      canCreateUnlimitedEndpoints: false,
      activePlan: "Cloud Free",
    };
  }

  const isPremium = Boolean(has({ plan: BILLING.plan }));
  const canUseEmailAlerts =
    isPremium || Boolean(has({ feature: BILLING.features.emailAlerts }));
  const canUseCustomStatus =
    isPremium || Boolean(has({ feature: BILLING.features.customStatus }));
  const canCreateUnlimitedEndpoints =
    isPremium || Boolean(has({ feature: BILLING.features.unlimitedEndpoints }));

  return {
    isPremium,
    canUseEmailAlerts,
    canUseCustomStatus,
    canCreateUnlimitedEndpoints,
    activePlan: isPremium ? "Cloud Premium" : "Cloud Free",
  };
}

/**
 * Helper to check if a user ID possesses active Premium subscription status.
 * Checks authenticated session `has` function if provided, or MongoDB `subscriptions` collection.
 */
export async function isUserPremium(
  db: Db,
  userId: string,
  hasFn?: HasFn | null
): Promise<boolean> {
  if (!userId) return false;

  if (hasFn) {
    const entitlements = getEntitlements(hasFn);
    if (entitlements.isPremium) return true;
  }

  try {
    const activeSub = await db.collection("subscriptions").findOne({
      entityId: userId,
      plan: BILLING.plan,
      status: { $in: ["active", "subscription.active", "active_trial"] },
    });

    if (activeSub) return true;
  } catch (err) {
    console.warn("Failed to query user subscription from MongoDB:", err);
  }

  return false;
}
