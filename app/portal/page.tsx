"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  getPortalWebhookDetails,
  getPortalWebhookLogs,
  redrivePortalWebhookLog,
  type WebhookDefinition,
  type WebhookRequestLog,
} from "../lib/actions";
import {
  Terminal,
  Activity,
  Copy,
  RotateCw,
  CheckCircle,
  XCircle,
  Key,
  Database,
  Search,
  ExternalLink,
  ShieldCheck,
  Clock,
  Layers,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";

function PortalContent() {
  const searchParams = useSearchParams();
  const slugParam = searchParams.get("slug") || "";
  const isEmbed = searchParams.get("embed") === "true";

  const [inputSlug, setInputSlug] = useState(slugParam);
  const [activeSlug, setActiveSlug] = useState(slugParam);
  const [webhook, setWebhook] = useState<WebhookDefinition | null>(null);
  const [logs, setLogs] = useState<WebhookRequestLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const loadPortalData = async (slugToFetch: string) => {
    if (!slugToFetch) return;
    setLoading(true);
    try {
      const [details, logList] = await Promise.all([
        getPortalWebhookDetails(slugToFetch),
        getPortalWebhookLogs(slugToFetch),
      ]);
      setWebhook(details);
      setLogs(logList);
    } catch (e) {
      console.error("Portal fetch error", e);
      toast.error("Failed to load endpoint details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSlug) {
      loadPortalData(activeSlug);
    }
  }, [activeSlug]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputSlug.trim()) {
      setActiveSlug(inputSlug.trim());
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleRedrive = async (logId: string) => {
    if (!activeSlug) return;
    toast.promise(
      (async () => {
        const res = await redrivePortalWebhookLog(activeSlug, logId);
        if (res && "error" in res) {
          throw new Error(res.error);
        }
        await loadPortalData(activeSlug);
        return "Webhook delivery re-driven successfully!";
      })(),
      {
        loading: "Re-driving delivery...",
        success: (msg) => msg,
        error: (err) => err.message || "Re-drive failed",
      }
    );
  };

  return (
    <div
      className={clsx(
        "min-h-screen text-slate-100 font-sans p-4 sm:p-6",
        isEmbed ? "bg-slate-950" : "bg-slate-950/95"
      )}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Header Bar */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Terminal className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                Developer Webhook Portal
              </h1>
              <p className="text-xs text-slate-400">
                Self-service endpoint management, delivery log inspection, and webhook re-drive.
              </p>
            </div>
          </div>

          {/* Search slug input */}
          <form onSubmit={handleSearch} className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Enter Endpoint Slug..."
                value={inputSlug}
                onChange={(e) => setInputSlug(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0"
            >
              Load
            </button>
          </form>
        </header>

        {loading ? (
          <div className="text-center py-16 text-slate-400">
            <RotateCw className="h-8 w-8 animate-spin text-indigo-500 mx-auto mb-3" />
            <p className="text-sm font-medium">Loading portal data...</p>
          </div>
        ) : !webhook ? (
          <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800 p-8 space-y-4">
            <Layers className="h-12 w-12 text-slate-600 mx-auto" />
            <h2 className="text-lg font-bold text-slate-200">No Endpoint Selected</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Please specify an endpoint slug above or pass <code className="text-indigo-400 font-mono">?slug=YOUR_SLUG</code> in the URL to inspect webhooks.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Endpoint Overview Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                <div>
                  <span className="text-xs font-mono uppercase font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded border border-indigo-500/20">
                    {webhook.method}
                  </span>
                  <h2 className="text-xl font-bold text-white mt-2">{webhook.name}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300">
                    Status Code: <span className="text-emerald-400 font-bold">{webhook.status}</span>
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300">
                    Content-Type: <span className="text-indigo-300">{webhook.contentType}</span>
                  </span>
                </div>
              </div>

              {/* Public URL Box */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1 w-full truncate">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Public Webhook Receiver URL</span>
                  <p className="text-xs font-mono text-indigo-300 truncate">
                    {typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/{webhook.slug}
                  </p>
                </div>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `${typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/${webhook.slug}`
                    )
                  }
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy URL
                </button>
              </div>

              {/* Public Asymmetric Key Section if enabled */}
              {webhook.asymmetricSigningEnabled && webhook.publicKey && (
                <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5 uppercase">
                      <ShieldCheck className="h-4 w-4" /> Asymmetric Public Verification Key ({webhook.asymmetricKeyType?.toUpperCase() || "ED25519"})
                    </span>
                    <button
                      onClick={() => copyToClipboard(webhook.publicKey || "")}
                      className="text-xs text-indigo-300 hover:text-indigo-200 font-semibold cursor-pointer"
                    >
                      Copy Public Key
                    </button>
                  </div>
                  <pre className="text-[10px] font-mono text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800 overflow-x-auto max-h-32">
                    {webhook.publicKey}
                  </pre>
                </div>
              )}
            </div>

            {/* Delivery Logs Inspection */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-md font-bold text-white flex items-center gap-2">
                  <Activity className="h-5 w-5 text-indigo-400" /> Recent Webhook Executions & Delivery Logs
                </h3>
                <button
                  onClick={() => loadPortalData(activeSlug)}
                  className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 cursor-pointer"
                  title="Refresh Logs"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
              </div>

              {logs.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No requests captured yet for this endpoint.
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {logs.map((log) => {
                    const isExpanded = expandedLogId === log._id;
                    const isSuccess = log.responseStatus && log.responseStatus >= 200 && log.responseStatus < 300;
                    return (
                      <div
                        key={log._id}
                        className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden"
                      >
                        <div
                          onClick={() => setExpandedLogId(isExpanded ? null : log._id || null)}
                          className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-900/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={clsx(
                                "text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase",
                                log.method === "POST" ? "bg-emerald-500/10 text-emerald-400" : "bg-sky-500/10 text-sky-400"
                              )}
                            >
                              {log.method}
                            </span>
                            <span className="text-xs text-slate-300 font-mono">{log.clientIp}</span>
                            <span className="text-xs text-slate-500">• {new Date(log.timestamp).toLocaleString()}</span>
                          </div>

                          <div className="flex items-center gap-3">
                            {log.forwardedUrl && (
                              <span
                                className={clsx(
                                  "text-[10px] font-bold px-2 py-0.5 rounded border uppercase",
                                  log.deliveryStatus === "SUCCESS"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    : log.deliveryStatus === "DLQ"
                                    ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                )}
                              >
                                Delivery: {log.deliveryStatus}
                              </span>
                            )}
                            <span
                              className={clsx(
                                "text-xs font-bold font-mono px-2 py-0.5 rounded",
                                isSuccess ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                              )}
                            >
                              {log.responseStatus || 200}
                            </span>
                          </div>
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="p-4 border-t border-slate-800 bg-slate-950/80 space-y-3 font-mono text-xs">
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Payload Body</span>
                              <pre className="bg-slate-900 p-3 rounded border border-slate-800 overflow-x-auto text-slate-300">
                                {log.body || "(empty)"}
                              </pre>
                            </div>

                            {log.forwardedUrl && (
                              <div className="bg-slate-900/60 p-3 rounded border border-slate-800 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-slate-300">Proxy Target Delivery</span>
                                  {log.deliveryStatus === "DLQ" && log._id && (
                                    <button
                                      onClick={() => handleRedrive(log._id!)}
                                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                      <RotateCw className="h-3 w-3" /> Re-drive Delivery
                                    </button>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400">Target: <code className="text-indigo-300">{log.forwardedUrl}</code></p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WhiteLabelPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
          <RotateCw className="h-8 w-8 animate-spin text-indigo-500 mr-2" />
          Loading White-Label Customer Portal...
        </div>
      }
    >
      <PortalContent />
    </Suspense>
  );
}
