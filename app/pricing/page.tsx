"use client";

import {
  PricingTable,
  Show,
  SignInButton,
  SignUpButton,
  useAuth,
  useClerk,
} from "@clerk/nextjs";
import { Check, HelpCircle, Sparkles, AlertCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import React from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { BILLING } from "../lib/billing";

class PricingTableBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error?.message || "Billing is not available.",
    };
  }

  componentDidCatch(error: Error) {
    console.warn("PricingTable failed to render:", error);
  }

  render() {
    if (this.state.hasError) {
      const billingDisabled =
        this.state.message.includes("billing is disabled") ||
        this.state.message.includes("cannot_render_billing_disabled");

      return (
        <div className="bg-amber-950/30 border border-amber-900/50 rounded-xl p-5 flex items-start gap-3 text-slate-300 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-amber-400" />
          <div className="space-y-2">
            <p className="font-bold text-white">
              {billingDisabled ? "Clerk Billing is not enabled yet" : "Could not load pricing"}
            </p>
            <p className="text-slate-400 text-xs leading-relaxed">
              {billingDisabled ? (
                <>
                  Enable Billing in the{" "}
                  <a
                    href="https://dashboard.clerk.com/last-active?path=billing/settings"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 underline"
                  >
                    Clerk Dashboard
                  </a>
                  , or run{" "}
                  <code className="text-indigo-300 bg-slate-950 px-1.5 py-0.5 rounded text-[11px]">
                    npx clerk auth login && npx clerk enable billing --for users --yes
                  </code>
                  , then apply{" "}
                  <code className="text-indigo-300 bg-slate-950 px-1.5 py-0.5 rounded text-[11px]">
                    clerk/billing.json
                  </code>
                  .
                </>
              ) : (
                this.state.message
              )}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function CurrentPlanBanner() {
  const { has, isLoaded } = useAuth();

  if (!isLoaded) return null;

  const isPremium = has?.({ plan: BILLING.plan });

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 px-5 py-4">
      <div className="text-sm text-slate-300">
        Current plan:{" "}
        <span className="font-semibold text-white">
          {isPremium ? "Cloud Premium" : "Cloud Free"}
        </span>
        {!isPremium && (
          <span className="text-slate-500">
            {" "}
            · {BILLING.freeEndpointLimit} endpoints, standard statuses only
          </span>
        )}
      </div>
      <Show when={{ plan: BILLING.plan }}>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
          <Sparkles className="h-3 w-3" /> Premium active
        </span>
      </Show>
    </div>
  );
}

function SessionRefreshOnUpgrade() {
  const searchParams = useSearchParams();
  const { session } = useClerk();
  const refreshed = React.useRef(false);

  React.useEffect(() => {
    if (refreshed.current) return;
    if (searchParams.get("upgraded") !== "1") return;
    refreshed.current = true;
    void session?.reload().then(() => {
      toast.success("Subscription updated — Cloud Premium entitlements are active.");
    });
  }, [searchParams, session]);

  return null;
}

export default function PricingPage() {
  return (
    <div className="bg-slate-950 text-slate-100 min-h-[calc(100vh-4rem)] py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        <React.Suspense fallback={null}>
          <SessionRefreshOnUpgrade />
        </React.Suspense>

        <div className="text-center space-y-3">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
            Choose Your Tier
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm font-medium leading-relaxed">
            Self-host under MIT for free, or subscribe to managed Cloud Premium with
            unlimited endpoints, email alerts, and custom statuses.
          </p>
        </div>

        <Show when="signed-in">
          <CurrentPlanBanner />
        </Show>

        <Show
          when="signed-out"
          fallback={null}
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 px-5 py-4">
            <p className="text-sm text-slate-300">Sign in to subscribe to Cloud Premium.</p>
            <div className="flex items-center gap-2">
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-200 bg-slate-900 border border-slate-700 rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button
                  type="button"
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 cursor-pointer"
                >
                  Sign Up
                </button>
              </SignUpButton>
            </div>
          </div>
        </Show>

        <div className="bg-slate-900/20 border border-slate-900/60 rounded-3xl p-6 sm:p-10 shadow-2xl">
          <PricingTableBoundary>
            <PricingTable
              for="user"
              newSubscriptionRedirectUrl="/pricing?upgraded=1"
              fallback={
                <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-sm">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading plans…
                </div>
              }
              appearance={{
                elements: {
                  rootBox: "w-full",
                  pricingTable: "gap-6",
                },
              }}
            />
          </PricingTableBoundary>
        </div>

        {/* Self-hosted comparison (not a fake checkout) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-950 border border-slate-900 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Self-Hosted (OSS)</h3>
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded-full">
                MIT
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Run Endpoint Builders on your own infrastructure — no Clerk subscription required.
            </p>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                Unlimited custom endpoints
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                Your MongoDB & Resend keys
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                No managed SaaS fees
              </li>
            </ul>
            <a
              href="https://github.com/nexai2024/ss-webhook-server"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-sm font-semibold text-indigo-400 hover:text-indigo-300"
            >
              View on GitHub →
            </a>
          </div>

          <div className="bg-indigo-600/10 border border-indigo-500/30 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Cloud Premium</h3>
              <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-200 bg-indigo-600/40 px-2 py-1 rounded-full flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Plan slug: {BILLING.plan}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Entitlements enforced server-side via Clerk{" "}
              <code className="text-indigo-300">has()</code>.
            </p>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                Feature: {BILLING.features.unlimitedEndpoints}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                Feature: {BILLING.features.emailAlerts}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                Feature: {BILLING.features.customStatus}
              </li>
            </ul>
            <Link href="/" className="inline-flex text-sm font-semibold text-indigo-400 hover:text-indigo-300">
              Back to dashboard →
            </Link>
          </div>
        </div>

        <div className="max-w-3xl mx-auto pt-4 space-y-6">
          <h3 className="text-lg font-bold text-white text-center flex items-center justify-center gap-2">
            <HelpCircle className="h-5 w-5 text-indigo-400" /> Platform Questions & Answers
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-300 leading-relaxed">
            <div className="space-y-1.5 p-5 bg-slate-900/40 rounded-2xl border border-slate-900">
              <h4 className="font-bold text-white">How does checkout work?</h4>
              <p className="text-slate-400">
                Selecting a plan opens Clerk&apos;s in-app checkout drawer. In development, Clerk uses a shared test payment gateway — no Stripe account required. Production needs your Stripe account connected in Billing Settings.
              </p>
            </div>
            <div className="space-y-1.5 p-5 bg-slate-900/40 rounded-2xl border border-slate-900">
              <h4 className="font-bold text-white">When do entitlements apply?</h4>
              <p className="text-slate-400">
                After a successful subscribe, your session refreshes automatically (or on next navigation). Server actions then unlock email alerts, custom statuses, and unlimited endpoints.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
