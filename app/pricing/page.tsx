"use client";

import { PricingTable } from "@clerk/nextjs";
import { Check, Sparkles, AlertCircle, Terminal, HelpCircle } from "lucide-react";
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
          <div className="bg-indigo-950/40 border border-indigo-900/60 rounded-xl p-4 flex items-start gap-3 max-w-2xl mx-auto text-slate-300 text-xs font-sans">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-indigo-400" />
            <div>
              <p className="font-bold text-white">Clerk Billing Sandbox Mode</p>
              <p className="mt-1">
                Clerk Billing is not yet activated on this development instance. We've automatically loaded our highly detailed **OSS vs Managed SaaS Pricing Simulator** below.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto pt-4 font-sans">
            {/* Self-Hosted OSS Tier */}
            <div className="bg-slate-950 border border-slate-900 rounded-2xl p-8 flex flex-col justify-between hover:border-slate-800 transition-all shadow-xl relative">
              <span className="absolute -top-3 left-6 bg-slate-800 text-slate-300 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                MIT Licensed
              </span>
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white">Self-Hosted (OSS)</h3>
                  <p className="text-xs text-slate-400 mt-1">Deploy locally or on your own VPS infrastructure.</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">Free</span>
                  <span className="text-xs text-slate-400 font-medium">/ forever</span>
                </div>
                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>**Unlimited** custom endpoints</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>No Webhook.site rate limits</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Run on localhost or VPS under MIT</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Connect your own MongoDB & Resend</span>
                  </li>
                </ul>
              </div>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="w-full text-center mt-8 py-3 rounded-xl bg-slate-900 border border-slate-800 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer">
                View on GitHub
              </a>
            </div>

            {/* Cloud Free Tier */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-8 flex flex-col justify-between hover:border-slate-800 transition-all shadow-xl">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white">Cloud Free</h3>
                  <p className="text-xs text-slate-400 mt-1">Zero configuration. Fully managed by us.</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">$0</span>
                  <span className="text-xs text-slate-400 font-medium">/ month</span>
                </div>
                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-indigo-400 shrink-0" />
                    <span>Up to 2 active cloud endpoints</span>
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
                    <span>Custom status responses (4xx, 5xx)</span>
                  </li>
                </ul>
              </div>
              <button type="button" className="w-full mt-8 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm font-semibold text-slate-300 hover:bg-slate-900 hover:text-white transition-colors cursor-pointer">
                Current Plan
              </button>
            </div>

            {/* Cloud Premium Tier */}
            <div className="bg-indigo-600/10 border-2 border-indigo-500/30 rounded-2xl p-8 flex flex-col justify-between hover:border-indigo-500/50 transition-all shadow-2xl relative">
              <span className="absolute -top-3 right-6 bg-indigo-600 text-white text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Managed Cloud
              </span>
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white">Cloud Premium</h3>
                  <p className="text-xs text-slate-400 mt-1">Unlimited managed scale and absolute control.</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">$19</span>
                  <span className="text-xs text-slate-400 font-medium">/ month</span>
                </div>
                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>**Unlimited** cloud endpoints</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Custom error statuses (4xx, 5xx, etc.)</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Instant Resend & React Email alerts</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Zero hosting or DB maintenance</span>
                  </li>
                </ul>
              </div>
              <button type="button" className="w-full mt-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all cursor-pointer font-sans">
                Upgrade Cloud Subscription
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
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
            Choose Your Tier
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm font-medium leading-relaxed">
            Get unlimited requests under MIT license with our completely free self-hosted edition, or use our zero-setup Managed Cloud hosting built with Clerk subscriptions.
          </p>
        </div>

        {/* Error Boundary Wrapped Pricing Table Component */}
        <div className="bg-slate-900/20 border border-slate-900/60 rounded-3xl p-6 sm:p-10 shadow-2xl">
          <ErrorBoundary>
            <PricingTable />
          </ErrorBoundary>
        </div>

        {/* FAQ Section addressing dev pain points */}
        <div className="max-w-3xl mx-auto pt-8 space-y-6">
          <h3 className="text-lg font-bold text-white text-center flex items-center justify-center gap-2">
            <HelpCircle className="h-5 w-5 text-indigo-400" /> Platform Questions & Answers
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-300 leading-relaxed">
            <div className="space-y-1.5 p-5 bg-slate-900/40 rounded-2xl border border-slate-900">
              <h4 className="font-bold text-white">How does Self-Hosted differ from Cloud?</h4>
              <p className="text-slate-400">
                Our self-hosted edition is licensed under MIT and entirely free. There are no rate limits, and you run it on your own server. Cloud Managed handles all clustering, storage configurations, database scaling, and authentication for you.
              </p>
            </div>
            <div className="space-y-1.5 p-5 bg-slate-900/40 rounded-2xl border border-slate-900">
              <h4 className="font-bold text-white">Why build Endpoint Hub?</h4>
              <p className="text-slate-400">
                As developers, we were frustrated with hitting Webhook.site rate limits just to quickly view incoming event parameters. We built this platform as an open, unlimited alternative that you can deploy in one click without paying for enterprise infrastructure.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
