"use client";

import { SignInButton, SignUpButton, UserButton, Show } from "@clerk/nextjs";
import Link from "next/link";
import { BILLING } from "../lib/billing";

export default function Header() {
  return (
    <nav className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg text-white">
              <span className="p-1.5 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30 font-sans">
                ⚡
              </span>
              <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
                Endpoint Builders
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <Link href="/" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
                Dashboard
              </Link>
              <Link href="/pricing" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
                Pricing Plans
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="md:hidden flex items-center gap-3 mr-2">
              <Link href="/" className="text-xs text-slate-300 hover:text-white">
                Dashboard
              </Link>
              <Link href="/pricing" className="text-xs text-slate-300 hover:text-white">
                Pricing
              </Link>
            </div>

            <Show when="signed-out">
              <div className="flex items-center gap-3">
                <SignInButton mode="modal">
                  <button type="button" className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button type="button" className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors cursor-pointer shadow-lg shadow-indigo-600/15">
                    Sign Up
                  </button>
                </SignUpButton>
              </div>
            </Show>
            <Show when="signed-in">
              <div className="flex items-center gap-4">
                <Show
                  when={{ plan: BILLING.plan }}
                  fallback={
                    <Link
                      href="/pricing"
                      className="hidden sm:inline-flex items-center text-xs text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20 font-medium hover:bg-indigo-500/20 transition-all"
                    >
                      Upgrade
                    </Link>
                  }
                >
                  <Link
                    href="/pricing"
                    className="hidden sm:inline-flex items-center text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 font-medium hover:bg-emerald-500/20 transition-all"
                  >
                    Premium
                  </Link>
                </Show>
                <UserButton>
                  <UserButton.MenuItems>
                    <UserButton.Link
                      label="Manage billing"
                      labelIcon={<span className="text-[10px]">$</span>}
                      href="/pricing"
                    />
                  </UserButton.MenuItems>
                </UserButton>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </nav>
  );
}
