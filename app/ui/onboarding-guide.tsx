"use client";

import * as React from "react";
import {
  Sparkles,
  CheckCircle2,
  Circle,
  ChevronRight,
  ChevronLeft,
  X,
  Play,
  PlusCircle,
  Activity,
  BookOpen,
  Share2,
  Check,
  Zap,
} from "lucide-react";
import clsx from "clsx";

export interface OnboardingGuideProps {
  endpointsCount: number;
  totalLogsCount: number;
  hasSelectedEndpoint: boolean;
  activeTab: "logs" | "playground" | "dlq" | "portal";
  onDemoFill?: () => void;
  onTestWebhook?: () => void;
  onSwitchTab?: (tab: "logs" | "playground" | "dlq" | "portal") => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export interface StepItem {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  isCompleted: boolean;
  actionText: string;
  actionIcon: React.ElementType;
  onAction?: () => void;
  secondaryActionText?: string;
  secondaryActionIcon?: React.ElementType;
  onSecondaryAction?: () => void;
}

export function OnboardingGuide({
  endpointsCount,
  totalLogsCount,
  hasSelectedEndpoint,
  activeTab,
  onDemoFill,
  onTestWebhook,
  onSwitchTab,
  isOpen,
  onToggleOpen,
}: OnboardingGuideProps) {
  const [activeStepIndex, setActiveStepIndex] = React.useState(0);
  const [manualCompleted, setManualCompleted] = React.useState<Record<number, boolean>>({});

  // Auto-detect completions based on app state or manual toggles
  const step1Completed = endpointsCount > 0 || !!manualCompleted[0];
  const step2Completed = totalLogsCount > 0 || !!manualCompleted[1];
  const step3Completed = totalLogsCount > 0 || !!manualCompleted[2];
  const step4Completed =
    activeTab === "playground" || activeTab === "portal" || !!manualCompleted[3];

  const steps: StepItem[] = [
    {
      id: 0,
      title: "1. Create Your First Endpoint",
      subtitle: "Define path, HTTP status, and response payload",
      description:
        "Define custom webhook endpoints with custom status codes, fan-out proxy targets, HMAC verification, and Basic Auth.",
      isCompleted: step1Completed,
      actionText: "Auto-Fill Demo Endpoint",
      actionIcon: PlusCircle,
      onAction: onDemoFill,
    },
    {
      id: 1,
      title: "2. Trigger a Test Request",
      subtitle: "Dispatch a simulated payload to test receiver",
      description:
        "Send simulated webhooks right from the dashboard to verify real-time streaming and payload capturing.",
      isCompleted: step2Completed,
      actionText: "Send Quick Test Request",
      actionIcon: Play,
      onAction: onTestWebhook,
    },
    {
      id: 2,
      title: "3. Inspect Captured Logs",
      subtitle: "Analyze HTTP headers, query parameters, and payload",
      description:
        "Inspect captured request metadata, client IPs, header keys, HMAC verification status, and proxy delivery retries.",
      isCompleted: step3Completed,
      actionText: "Open Execution Inspector",
      actionIcon: Activity,
      onAction: () => onSwitchTab?.("logs"),
    },
    {
      id: 3,
      title: "4. Interactive Playground & White-Label Portal",
      subtitle: "Test in browser and offer self-service portal to clients",
      description:
        "Use the live interactive API test harness to test webhooks in browser, or embed the white-label portal for end-users.",
      isCompleted: step4Completed,
      actionText: "Open Interactive Playground",
      actionIcon: BookOpen,
      onAction: () => onSwitchTab?.("playground"),
      secondaryActionText: "Embed Customer Portal",
      secondaryActionIcon: Share2,
      onSecondaryAction: () => onSwitchTab?.("portal"),
    },
  ];

  const completedCount = steps.filter((s) => s.isCompleted).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);
  const isAllCompleted = completedCount === steps.length;

  const handleToggleManualComplete = (stepId: number) => {
    setManualCompleted((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  };

  const currentStep = steps[activeStepIndex];

  if (!isOpen) {
    return (
      <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-4 font-sans backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Getting Started Guide</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {completedCount} / {steps.length} Steps
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {isAllCompleted
                ? "🎉 You have completed all quickstart steps!"
                : `Next up: ${currentStep.title}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-24 bg-slate-950 h-2 rounded-full border border-slate-800 overflow-hidden hidden sm:block">
            <div
              className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <button
            type="button"
            onClick={onToggleOpen}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
          >
            Open Guide <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-2xl space-y-6 font-sans relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute -top-24 -right-24 w-60 h-60 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <Zap className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-white">Interactive Getting Started Guide</h2>
              {isAllCompleted && (
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <Check className="h-3 w-3" /> Completed
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Follow these interactive steps to master webhook creation, testing, inspecting, and portal integration.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleOpen}
            className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg border border-slate-800 transition-colors cursor-pointer"
            title="Minimize Guide"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2 relative z-10">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-slate-300">
            Progress: <span className="text-indigo-400">{completedCount} of {steps.length} completed</span>
          </span>
          <span className="text-emerald-400 font-bold">{progressPercent}%</span>
        </div>
        <div className="w-full bg-slate-950 h-2.5 rounded-full border border-slate-800 overflow-hidden">
          <div
            className="bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 h-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Step Stepper Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 relative z-10">
        {steps.map((step, idx) => {
          const isActive = activeStepIndex === idx;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setActiveStepIndex(idx)}
              className={clsx(
                "p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5",
                isActive
                  ? "bg-indigo-600/15 border-indigo-500/60 shadow-lg"
                  : step.isCompleted
                  ? "bg-slate-950/60 border-emerald-500/30 hover:bg-slate-950"
                  : "bg-slate-950/40 border-slate-800 hover:bg-slate-950/80"
              )}
            >
              <div className="mt-0.5 shrink-0">
                {step.isCompleted ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Circle className={clsx("h-4 w-4", isActive ? "text-indigo-400" : "text-slate-600")} />
                )}
              </div>
              <div className="space-y-0.5 min-w-0">
                <p className={clsx("text-xs font-bold truncate", isActive ? "text-white" : "text-slate-300")}>
                  {step.title}
                </p>
                <p className="text-[10px] text-slate-400 truncate">{step.subtitle}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Step Panel */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Step {currentStep.id + 1} of 4</span>
              {currentStep.isCompleted && (
                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Completed
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-white">{currentStep.title}</h3>
            <p className="text-xs text-slate-300 max-w-2xl">{currentStep.description}</p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {currentStep.onAction && (
              <button
                type="button"
                onClick={currentStep.onAction}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer"
              >
                {React.createElement(currentStep.actionIcon, { className: "h-4 w-4" })}
                {currentStep.actionText}
              </button>
            )}

            {currentStep.onSecondaryAction && (
              <button
                type="button"
                onClick={currentStep.onSecondaryAction}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
              >
                {currentStep.secondaryActionIcon && React.createElement(currentStep.secondaryActionIcon, { className: "h-4 w-4 text-sky-400" })}
                {currentStep.secondaryActionText}
              </button>
            )}

            <button
              type="button"
              onClick={() => handleToggleManualComplete(currentStep.id)}
              className={clsx(
                "px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1.5",
                manualCompleted[currentStep.id]
                  ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
              )}
              title="Toggle manual mark complete"
            >
              <Check className="h-3.5 w-3.5" />
              {manualCompleted[currentStep.id] ? "Mark Incomplete" : "Mark Done"}
            </button>
          </div>
        </div>

        {/* Step Navigation Controls */}
        <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs">
          <button
            type="button"
            disabled={activeStepIndex === 0}
            onClick={() => setActiveStepIndex((prev) => Math.max(0, prev - 1))}
            className="flex items-center gap-1 font-semibold text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" /> Previous Step
          </button>

          <span className="text-slate-500 font-mono text-[11px]">
            {activeStepIndex + 1} / {steps.length}
          </span>

          <button
            type="button"
            disabled={activeStepIndex === steps.length - 1}
            onClick={() => setActiveStepIndex((prev) => Math.min(steps.length - 1, prev + 1))}
            className="flex items-center gap-1 font-semibold text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          >
            Next Step <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
