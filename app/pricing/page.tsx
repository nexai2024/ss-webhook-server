"use client";

import { PricingTable } from "@clerk/nextjs";
import { Check, Sparkles, AlertCircle } from "lucide-react";
import React from "react";

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.warn("Clerk billing not configured or error rendering PricingTable:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="space-y-8">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3 max-w-2xl mx-auto text-amber-400 text-xs">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Clerk Billing Preview Fallback</p>
              <p className="mt-1">
                Clerk Billing is not yet enabled in this development instance. We've rendered our polished pricing tier simulator below. Once you enable Billing in your Clerk Dashboard, the native <code className="bg-slate-950 px-1 py-0.5 rounded font-mono">{"<PricingTable />"}</code> will automatically take over!
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto pt-4 font-sans">
            {/* Free Tier */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-8 flex flex-col justify-between hover:border-slate-800 transition-all shadow-xl">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white">Free Plan</h3>
                  <p className="text-xs text-slate-400 mt-1">Perfect for getting started and simple testing.</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">$0</span>
                  <span className="text-xs text-slate-400 font-medium">/ month</span>
                </div>
                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-indigo-400 shrink-0" />
                    <span>Up to 2 custom endpoints</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-indigo-400 shrink-0" />
                    <span>Standard HTTP 200/201/204 responses</span>
                  </li>
                  <li className="flex items-center gap-2.5 text-slate-500 line-through">
                    <Check className="h-4 w-4 shrink-0" />
                    <span>Instant Email Alerts (via Resend)</span>
                  </li>
                  <li className="flex items-center gap-2.5 text-slate-500 line-through">
                    <Check className="h-4 w-4 shrink-0" />
                    <span>Custom error statuses (4xx, 5xx)</span>
                  </li>
                </ul>
              </div>
              <button type="button" className="w-full mt-8 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm font-semibold text-slate-300 hover:bg-slate-900 hover:text-white transition-colors cursor-pointer">
                Current Plan
              </button>
            </div>

            {/* Premium Tier */}
            <div className="bg-indigo-600/10 border-2 border-indigo-500/30 rounded-2xl p-8 flex flex-col justify-between hover:border-indigo-500/50 transition-all shadow-2xl relative">
              <span className="absolute -top-3 right-6 bg-indigo-600 text-white text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Popular
              </span>
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white">Premium Plan</h3>
                  <p className="text-xs text-slate-400 mt-1">For advanced developers requiring complete customizability.</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">$19</span>
                  <span className="text-xs text-slate-400 font-medium">/ month</span>
                </div>
                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Unlimited custom endpoints</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Custom response statuses (4xx, 5xx, etc.)</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Instant Resend & React Email alerts</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Prioritized execution logs</span>
                  </li>
                </ul>
              </div>
              <button type="button" className="w-full mt-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all cursor-pointer font-sans">
                Upgrade to Premium
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function PricingPage() {
  return (
    <div className="bg-slate-950 text-slate-100 min-h-[calc(100vh-4rem)] py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
            Choose Your Tier
          </h1>
          <p className="text-slate-400 max-w-lg mx-auto text-sm font-medium">
            Scale your dynamic endpoints and log capabilities. Upgrade to Premium for unlimited endpoints, custom responses, and instant email alerts.
          </p>
        </div>

        {/* Error Boundary Wrapped Pricing Table Component */}
        <div className="bg-slate-900/20 border border-slate-900/60 rounded-3xl p-6 sm:p-10 shadow-2xl">
          <ErrorBoundary>
            <PricingTable />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
