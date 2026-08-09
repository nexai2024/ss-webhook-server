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
} as const;

type HasFn = (args: { plan?: string; feature?: string }) => boolean;

export type Entitlements = {
  isPremium: boolean;
  canUseEmailAlerts: boolean;
  canUseCustomStatus: boolean;
  canCreateUnlimitedEndpoints: boolean;
  activePlan: string;
};

export function getEntitlements(has: HasFn): Entitlements {
  const isPremium = has({ plan: BILLING.plan });
  const canUseEmailAlerts =
    isPremium || has({ feature: BILLING.features.emailAlerts });
  const canUseCustomStatus =
    isPremium || has({ feature: BILLING.features.customStatus });
  const canCreateUnlimitedEndpoints =
    isPremium || has({ feature: BILLING.features.unlimitedEndpoints });

  return {
    isPremium,
    canUseEmailAlerts,
    canUseCustomStatus,
    canCreateUnlimitedEndpoints,
    activePlan: isPremium ? "Cloud Premium" : "Cloud Free",
  };
}
