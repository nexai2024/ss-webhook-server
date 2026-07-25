"use client";

import clsx from "clsx";
import { useFormStatus } from "react-dom";
import { useUser, SignInButton, SignUpButton } from "@clerk/nextjs";
import {
  createWebhook,
  getWebhooks,
  getWebhookLogs,
  deleteWebhook,
  clearWebhookLogs,
  getDashboardAnalytics,
  getUserTier,
  deleteWebhooksBatch,
  exportWebhooksBatch,
  updateWebhooksStatusBatch,
  getDLQLogs,
  redriveDLQPayload,
  type WebhookDefinition,
  type WebhookRequestLog
} from "./lib/actions";
import * as React from "react";
import { toast } from "sonner";
import {
  Terminal,
  Plus,
  Trash2,
  Copy,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  Code,
  Activity,
  Play,
  ChevronRight,
  ChevronDown,
  Bell,
  Mail,
  Zap,
  Globe,
  ArrowRight,
  Sparkles,
  Lock,
  Server,
  Sliders,
  Sparkle,
  Settings,
  Flame,
  CornerDownRight,
  HelpCircle,
  BookOpen,
  Send,
  RotateCw,
  FileDown
} from "lucide-react";
import Link from "next/link";

export default function Page() {
  const { isSignedIn, isLoaded, user } = useUser();
  const [state, dispatch] = React.useActionState(createWebhook, undefined);
  const [webhooks, setWebhooks] = React.useState<WebhookDefinition[]>([]);
  const [selectedSlug, setSelectedSlug] = React.useState<string>("");
  const [logs, setLogs] = React.useState<WebhookRequestLog[]>([]);
  const [dlqLogs, setDlqLogs] = React.useState<WebhookRequestLog[]>([]);
  const [analytics, setAnalytics] = React.useState({
    totalEndpoints: 0,
    totalLogs: 0,
    errors: 0,
    successes: 0,
  });
  const [tierInfo, setTierInfo] = React.useState({
    isPremium: false,
    activePlan: "Free Plan",
    endpointsCount: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const [loadingLogs, setLoadingLogs] = React.useState(false);
  const [loadingDLQ, setLoadingDLQ] = React.useState(false);
  const [expandedLogId, setExpandedLogId] = React.useState<string | null>(null);
  const [origin, setOrigin] = React.useState("http://localhost:3000");

  // Advanced settings toggle
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  // Tabs
  const [activeTab, setActiveTab] = React.useState<"logs" | "playground" | "dlq">("logs");

  // Multi-select webhooks
  const [selectedSlugs, setSelectedSlugs] = React.useState<string[]>([]);

  // Webhook Playground States
  const [pgHeaders, setPgHeaders] = React.useState<string>('{\n  "Content-Type": "application/json",\n  "X-Custom-Header": "EndpointHubPlayground"\n}');
  const [pgQuery, setPgQuery] = React.useState<string>('{\n  "source": "playground"\n}');
  const [pgBody, setPgBody] = React.useState<string>('{\n  "event": "user.signup",\n  "user": {\n    "id": "usr_90123",\n    "email": "tester@example.com"\n  }\n}');
  const [pgResponse, setPgResponse] = React.useState<{
    status: number;
    headers: Record<string, string>;
    body: string;
  } | null>(null);
  const [pgLoading, setPgLoading] = React.useState(false);

  // Keep track of client origin for rendering trigger URLs
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  // Fetch all endpoints and summary stats
  const fetchDashboardData = React.useCallback(async () => {
    if (!isSignedIn) return;
    setLoading(true);
    try {
      const [allWebhooks, stats, tier, dlqItems] = await Promise.all([
        getWebhooks(),
        getDashboardAnalytics(),
        getUserTier(),
        getDLQLogs()
      ]);
      setWebhooks(allWebhooks);
      setAnalytics(stats);
      setTierInfo(tier);
      setDlqLogs(dlqItems);

      // Default select the first webhook if none selected
      if (allWebhooks.length > 0 && !selectedSlug) {
        setSelectedSlug(allWebhooks[0].slug);
      }
    } catch (e) {
      console.error("Failed to load dashboard data", e);
      toast.error("Failed to load webhooks dashboard");
    } finally {
      setLoading(false);
    }
  }, [selectedSlug, isSignedIn]);

  // Load request logs for the selected webhook
  const fetchLogs = React.useCallback(async (slug: string) => {
    if (!slug || !isSignedIn) return;
    setLoadingLogs(true);
    try {
      const logList = await getWebhookLogs(slug);
      setLogs(logList);
    } catch (e) {
      console.error("Failed to load execution logs", e);
      toast.error("Failed to load request logs");
    } finally {
      setLoadingLogs(false);
    }
  }, [isSignedIn]);

  // Load DLQ
  const fetchDLQ = React.useCallback(async () => {
    if (!isSignedIn) return;
    setLoadingDLQ(true);
    try {
      const dlqItems = await getDLQLogs();
      setDlqLogs(dlqItems);
    } catch (e) {
      console.error("Failed to load DLQ", e);
    } finally {
      setLoadingDLQ(false);
    }
  }, [isSignedIn]);

  React.useEffect(() => {
    if (isSignedIn) {
      fetchDashboardData();
    }
  }, [fetchDashboardData, isSignedIn]);

  React.useEffect(() => {
    if (selectedSlug && isSignedIn) {
      fetchLogs(selectedSlug);
    } else {
      setLogs([]);
    }
  }, [selectedSlug, fetchLogs, isSignedIn]);

  // Listen to creation action updates
  React.useEffect(() => {
    if (!state) return;

    if ("error" in state) {
      toast.error(state.error);
    } else if ("data" in state) {
      toast.success(`Dynamic Webhook '${state.data.name}' configured successfully!`);
      setSelectedSlug(state.data.slug);
      fetchDashboardData();
    }
  }, [state, fetchDashboardData]);

  // Trigger simulated client-side test (Enhancement 3)
  const handleTestWebhook = async () => {
    if (!selectedSlug) return;
    const webhook = webhooks.find((w) => w.slug === selectedSlug);
    if (!webhook) return;

    const testUrl = `${origin}/api/webhooks/${selectedSlug}`;
    const testMethod = webhook.method === "ALL" ? "POST" : webhook.method;

    toast.promise(
      (async () => {
        const response = await fetch(testUrl, {
          method: testMethod,
          headers: {
            "Content-Type": "application/json",
            "X-Test-Sender": "Dynamic Webhooks Test Client"
          },
          body: testMethod !== "GET" ? JSON.stringify({
            test: true,
            message: "Simulated trigger payload from dashboard",
            timestamp: new Date().toISOString()
          }) : undefined
        });

        const text = await response.text();
        // Reload logs slightly after triggering
        setTimeout(() => {
          fetchLogs(selectedSlug);
          fetchDLQ();
          getDashboardAnalytics().then((stats) => setAnalytics(stats));
          getUserTier().then((tier) => setTierInfo(tier));
        }, 1000);

        return `Triggered successfully with Status: ${response.status}. Payload: ${text.substring(0, 50)}`;
      })(),
      {
        loading: "Dispatching simulation payload request to dynamic URL...",
        success: (data) => data,
        error: "Failed to dispatch test request"
      }
    );
  };

  const handleDeleteWebhook = async (slug: string) => {
    if (confirm("Are you sure you want to delete this endpoint? All logged executions will be permanently lost.")) {
      const res = await deleteWebhook(slug);
      if ("error" in res) {
        toast.error(res.error);
      } else {
        toast.success("Webhook endpoint deleted successfully");
        if (selectedSlug === slug) {
          setSelectedSlug("");
        }
        fetchDashboardData();
      }
    }
  };

  const handleClearLogs = async (slug: string) => {
    if (confirm("Are you sure you want to clear request logs for this endpoint?")) {
      const res = await clearWebhookLogs(slug);
      if ("error" in res) {
        toast.error(res.error);
      } else {
        toast.success("Request logs wiped successfully");
        fetchLogs(slug);
        getDashboardAnalytics().then((stats) => setAnalytics(stats));
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  // Re-drive manual replay
  const handleRedriveDLQ = async (logId: string) => {
    toast.promise(
      (async () => {
        const res = await redriveDLQPayload(logId);
        if (res && "error" in res) {
          throw new Error(res.error);
        }
        fetchDLQ();
        fetchLogs(selectedSlug);
        getDashboardAnalytics().then((stats) => setAnalytics(stats));
        return "DLQ Re-drive executed successfully!";
      })(),
      {
        loading: "Initiating proxy replay attempt...",
        success: (msg) => msg,
        error: (err: Error) => err.message || "Re-drive attempt failed."
      }
    );
  };

  // Webhook Batch Operations
  const handleToggleSelectWebhook = (slug: string) => {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleSelectAllWebhooks = () => {
    if (selectedSlugs.length === webhooks.length) {
      setSelectedSlugs([]);
    } else {
      setSelectedSlugs(webhooks.map((w) => w.slug));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSlugs.length === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedSlugs.length} selected webhooks?`)) {
      toast.promise(
        (async () => {
          const res = await deleteWebhooksBatch(selectedSlugs);
          if ("error" in res) {
            throw new Error(res.error);
          }
          setSelectedSlugs([]);
          fetchDashboardData();
          return res.data;
        })(),
        {
          loading: "Bulk deleting endpoints...",
          success: (msg) => msg,
          error: (err: Error) => err.message
        }
      );
    }
  };

  const handleBulkExport = async () => {
    if (selectedSlugs.length === 0) return;
    try {
      const data = await exportWebhooksBatch(selectedSlugs);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "webhook_configurations_export.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success(`Exported ${selectedSlugs.length} webhook configurations!`);
    } catch (e) {
      toast.error("Failed to export configurations");
    }
  };

  const handleBulkStatusUpdate = async (status: number) => {
    if (selectedSlugs.length === 0) return;
    toast.promise(
      (async () => {
        const res = await updateWebhooksStatusBatch(selectedSlugs, status);
        if ("error" in res) {
          throw new Error(res.error);
        }
        fetchDashboardData();
        return res.data;
      })(),
      {
        loading: "Updating status in bulk...",
        success: (msg) => msg,
        error: (err: Error) => err.message
      }
    );
  };

  // Run Playground Trigger Fetch Request
  const handlePlaygroundSend = async () => {
    if (!selectedSlug) return;
    setPgLoading(true);
    setPgResponse(null);

    const testUrl = `${origin}/api/webhooks/${selectedSlug}`;
    const webhook = webhooks.find((w) => w.slug === selectedSlug);
    const method = webhook ? (webhook.method === "ALL" ? "POST" : webhook.method) : "POST";

    let headersObj: Record<string, string> = {};
    let queryObj: Record<string, string> = {};

    try {
      headersObj = JSON.parse(pgHeaders);
    } catch {
      toast.error("Invalid JSON syntax in headers field.");
      setPgLoading(false);
      return;
    }

    try {
      queryObj = JSON.parse(pgQuery);
    } catch {
      toast.error("Invalid JSON syntax in query params field.");
      setPgLoading(false);
      return;
    }

    // Build URL with query params
    const urlWithParams = new URL(testUrl);
    for (const [key, val] of Object.entries(queryObj)) {
      urlWithParams.searchParams.append(key, val);
    }

    try {
      const res = await fetch(urlWithParams.toString(), {
        method,
        headers: headersObj,
        body: method !== "GET" && method !== "HEAD" ? pgBody : undefined,
      });

      const text = await res.text();
      const resHeaders: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        resHeaders[key] = val;
      });

      setPgResponse({
        status: res.status,
        headers: resHeaders,
        body: text,
      });

      toast.success(`Playground request completed with status: ${res.status}`);

      // Refresh log list and stats
      setTimeout(() => {
        fetchLogs(selectedSlug);
        fetchDLQ();
        getDashboardAnalytics().then((stats) => setAnalytics(stats));
      }, 1000);
    } catch (e: any) {
      toast.error(`Playground request failed: ${e.message}`);
    } finally {
      setPgLoading(false);
    }
  };

  // Health check badge calculation helper
  const renderHealthBadge = (wh: WebhookDefinition) => {
    if (!wh.forwardUrl) {
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-900 border border-slate-800 text-slate-500 flex items-center gap-1 shrink-0">
          N/A
        </span>
      );
    }

    // Filter logs for this webhook to calculate proxy delivery status
    const proxyLogs = logs.filter((l) => l.webhookSlug === wh.slug && l.forwardedUrl);
    if (proxyLogs.length === 0) {
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center gap-1 shrink-0 animate-pulse">
          PENDING
        </span>
      );
    }

    const recentFailures = proxyLogs.slice(0, 5).filter((l) => l.deliveryStatus === "DLQ").length;
    if (recentFailures === 0) {
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1 shrink-0">
          HEALTHY
        </span>
      );
    } else if (recentFailures < 3) {
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center gap-1 shrink-0">
          DEGRADED
        </span>
      );
    } else {
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-1 shrink-0">
          UNHEALTHY
        </span>
      );
    }
  };

  const selectedWebhook = webhooks.find((w) => w.slug === selectedSlug);

  // Render Loader during Clerk auth verification
  if (!isLoaded) {
    return (
      <div className="bg-slate-950 min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center text-slate-100 font-sans">
        <RefreshCw className="h-10 w-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-slate-400 text-sm animate-pulse">Loading workspace session...</p>
      </div>
    );
  }

  // Render Signed Out Landing Page
  if (!isSignedIn) {
    return (
      <div className="bg-slate-950 text-slate-100 min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center py-16 px-4 sm:px-6 lg:px-8 font-sans">
        <div className="max-w-4xl text-center space-y-8">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 px-3.5 py-1.5 rounded-full text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="h-4 w-4" /> MIT-Licensed & Self-Hostable • Unlimited Free Requests
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-none bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
            Unrate-limited Webhook Inspection
          </h1>

          <p className="text-lg text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed">
            Tired of paying for expensive enterprise infrastructure or hitting Webhook.site rate limits just to see what your webhooks are sending you? Get unlimited requests, MongoDB storage, and Resend notifications on your own server for free under MIT, or scale instantly with our Managed SaaS.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <SignUpButton mode="modal">
              <button type="button" className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-indigo-600/20 hover:bg-indigo-500 hover:scale-105 transition-all cursor-pointer">
                Get Started for Free <ArrowRight className="h-4 w-4" />
              </button>
            </SignUpButton>
            <Link href="/pricing" className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-slate-900 border border-slate-800 px-6 py-3.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer">
              Compare OSS vs Managed Cloud
            </Link>
          </div>

          {/* GTM / OSS vs SaaS Value Props */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12 text-left">
            <div className="bg-slate-900/50 border border-slate-900 p-6 rounded-2xl space-y-3 shadow-lg relative">
              <div className="absolute top-4 right-4 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                100% Free
              </div>
              <span className="p-2.5 bg-indigo-600/10 text-indigo-400 rounded-xl inline-block border border-indigo-500/10">
                <Server className="h-5 w-5" />
              </span>
              <h3 className="font-bold text-white flex items-center gap-2">
                MIT Self-Hosted
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                No rate limits, no subscription fees. Run on your own VPS or localhost and capture unlimited webhook requests. Genuine open-source developer freedom.
              </p>
            </div>

            <div className="bg-slate-900/50 border border-slate-900 p-6 rounded-2xl space-y-3 shadow-lg">
              <span className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl inline-block border border-emerald-500/10">
                <Database className="h-5 w-5" />
              </span>
              <h3 className="font-bold text-white">MongoDB Inspector</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tired of losing logs? Stream all webhook bodies, query parameters, client IP addresses, and HTTP headers directly to your MongoDB database for robust audits.
              </p>
            </div>

            <div className="bg-slate-900/50 border border-slate-900 p-6 rounded-2xl space-y-3 shadow-lg">
              <span className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl inline-block border border-amber-500/10">
                <Mail className="h-5 w-5" />
              </span>
              <h3 className="font-bold text-white">Resend Email Alerts</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Set up instant email notification alerts for high-priority webhooks. Get detailed React Email breakdowns sent to your inbox when events trigger.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Signed In Workspace Dashboard
  return (
    <div className="bg-slate-950 text-slate-100 min-h-[calc(100vh-4rem)] py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8 font-sans">

        {/* Header section with User and Subscription badge */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-slate-900 gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <span className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                <Terminal className="h-6 w-6" />
              </span>
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
                Dynamic Endpoint Hub
              </h1>
              {/* Subscription Plan Badge */}
              <span className={clsx(
                "text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider border",
                tierInfo.isPremium
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
              )}>
                {tierInfo.activePlan}
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Welcome back, <span className="text-white font-semibold">{user?.firstName || "Developer"}</span>. Manage your dynamic webhook endpoints below.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-300 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
              Refresh Hub
            </button>
          </div>
        </header>

        {/* Dashboard Analytics summary counters */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl flex items-center gap-4 shadow-xl">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <Globe className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Endpoints</p>
              <h3 className="text-2xl font-bold mt-1 text-white">
                {analytics.totalEndpoints} <span className="text-xs font-normal text-slate-500">/ {tierInfo.isPremium ? "∞" : "2"}</span>
              </h3>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl flex items-center gap-4 shadow-xl">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Request Logs</p>
              <h3 className="text-2xl font-bold mt-1 text-white">{analytics.totalLogs}</h3>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl flex items-center gap-4 shadow-xl">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Successes (2xx)</p>
              <h3 className="text-2xl font-bold mt-1 text-emerald-400">{analytics.successes}</h3>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl flex items-center gap-4 shadow-xl">
            <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl">
              <XCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Errors (4xx+)</p>
              <h3 className="text-2xl font-bold mt-1 text-rose-400">{analytics.errors}</h3>
            </div>
          </div>
        </section>

        {/* Form and logs console panels */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Creator form */}
          <section className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden font-sans">
            <div className="p-6 border-b border-slate-800 bg-slate-900/40">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="h-5 w-5 text-indigo-400" />
                Define Dynamic Webhook
              </h2>
              <p className="text-xs text-slate-400 mt-1">Configure path, routing methods, mock HTTP responses, proxying, and scheduled CRON triggers.</p>
            </div>

            <form action={dispatch} className="p-6 space-y-5">
              {/* Webhook Name */}
              <div className="space-y-1.5">
                <label htmlFor="name" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Webhook Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. Stripe Checkout Completed"
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                />
              </div>

              {/* Endpoint path Suffix / Slug */}
              <div className="space-y-1.5">
                <label htmlFor="slug" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  URL Path Suffix (Slug)
                </label>
                <div className="flex rounded-lg shadow-sm">
                  <span className="inline-flex items-center rounded-l-lg border border-r-0 border-slate-800 bg-slate-950 px-3 text-xs text-slate-500 select-none">
                    /api/webhooks/
                  </span>
                  <input
                    id="slug"
                    name="slug"
                    type="text"
                    placeholder="stripe-checkout (or blank to auto-generate)"
                    className="block w-full rounded-r-lg border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Method and response code settings */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="method" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    HTTP Method
                  </label>
                  <select
                    id="method"
                    name="method"
                    defaultValue="POST"
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ALL">ALL (Any method)</option>
                    <option value="GET">GET Only</option>
                    <option value="POST">POST Only</option>
                    <option value="PUT">PUT Only</option>
                    <option value="DELETE">DELETE Only</option>
                    <option value="PATCH">PATCH Only</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="status" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Response Status
                    </label>
                    {!tierInfo.isPremium && (
                      <span className="text-[10px] text-amber-500 font-semibold flex items-center gap-1">
                        <Lock className="h-2.5 w-2.5" /> Premium Statuses
                      </span>
                    )}
                  </div>
                  <select
                    id="status"
                    name="status"
                    defaultValue="200"
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="200">200 OK</option>
                    <option value="201">201 Created</option>
                    <option value="204">204 No Content</option>
                    <option value="400">400 Bad Request {!tierInfo.isPremium && "🔑"}</option>
                    <option value="401">401 Unauthorized {!tierInfo.isPremium && "🔑"}</option>
                    <option value="403">403 Forbidden {!tierInfo.isPremium && "🔑"}</option>
                    <option value="404">404 Not Found {!tierInfo.isPremium && "🔑"}</option>
                    <option value="500">500 Server Error {!tierInfo.isPremium && "🔑"}</option>
                  </select>
                </div>
              </div>

              {/* Response Content Type */}
              <div className="space-y-1.5">
                <label htmlFor="contentType" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Response Content-Type
                </label>
                <select
                  id="contentType"
                  name="contentType"
                  defaultValue="application/json"
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="application/json">application/json (JSON)</option>
                  <option value="text/plain">text/plain (Plain text)</option>
                  <option value="text/html">text/html (HTML page/payload)</option>
                  <option value="application/xml">application/xml (XML)</option>
                </select>
              </div>

              {/* Response Payload Body */}
              <div className="space-y-1.5">
                <label htmlFor="body" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Response Body Payload
                </label>
                <textarea
                  id="body"
                  name="body"
                  rows={4}
                  required
                  defaultValue='{ "received": true, "status": "processed", "id": 10934 }'
                  placeholder="Enter JSON, text, or HTML template..."
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Collapsible Advanced Settings (Proxying, transformations, delay, cron schedule) */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between p-4 text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-slate-900/60 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-indigo-400" /> Advanced Options
                  </span>
                  <ChevronDown className={clsx("h-4 w-4 text-slate-500 transition-transform", showAdvanced && "rotate-180")} />
                </button>

                {showAdvanced && (
                  <div className="p-4 border-t border-slate-800 space-y-4 bg-slate-950/40 font-sans">
                    {/* Webhook Forwarding/Proxy Target */}
                    <div className="space-y-1.5">
                      <label htmlFor="forwardUrl" className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                        Forward / Proxy target URL
                      </label>
                      <input
                        id="forwardUrl"
                        name="forwardUrl"
                        type="url"
                        placeholder="https://api.yourdomain.com/webhooks/receiver"
                        className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Retry Count */}
                      <div className="space-y-1.5">
                        <label htmlFor="retryCount" className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                          Proxy Retry Count
                        </label>
                        <select
                          id="retryCount"
                          name="retryCount"
                          defaultValue="3"
                          className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="0">0 retries (At-most-once)</option>
                          <option value="1">1 retry</option>
                          <option value="2">2 retries</option>
                          <option value="3">3 retries (Recommended)</option>
                          <option value="5">5 retries (Highly Guaranteed)</option>
                        </select>
                      </div>

                      {/* Response Delay */}
                      <div className="space-y-1.5">
                        <label htmlFor="delayMs" className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                          Artificial Latency
                        </label>
                        <select
                          id="delayMs"
                          name="delayMs"
                          defaultValue="0"
                          className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="0">No artificial delay (Fastest)</option>
                          <option value="500">500 ms delay</option>
                          <option value="1000">1.0 second delay</option>
                          <option value="2000">2.0 seconds delay</option>
                          <option value="5000">5.0 seconds (Test timeouts)</option>
                        </select>
                      </div>
                    </div>

                    {/* Scheduled Trigger (Cron Schedule) */}
                    <div className="space-y-1.5">
                      <label htmlFor="cronSchedule" className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                        CRON Schedule (e.g. daily, hourly)
                      </label>
                      <input
                        id="cronSchedule"
                        name="cronSchedule"
                        type="text"
                        placeholder="hourly, daily, or standard cron string"
                        className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Request payload transformations Javascript code */}
                    <div className="space-y-1.5">
                      <label htmlFor="transformScript" className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                        Javascript Payload Transformation
                      </label>
                      <textarea
                        id="transformScript"
                        name="transformScript"
                        rows={5}
                        placeholder={`// Input: "body" (object or string), "headers", "query"\n// Return transformed string or object:\n\nbody.timestamp = new Date().toISOString();\nbody.processedBy = "EndpointHub";\nreturn body;`}
                        className="block w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-[10px] font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Alert Notification Email */}
              <div className="space-y-1.5 bg-slate-950/40 p-3 rounded-lg border border-slate-800 relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-indigo-400">
                    <Bell className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Instant Email Alerts</span>
                  </div>
                  {!tierInfo.isPremium && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-bold">
                      <Lock className="h-2.5 w-2.5" /> Premium
                    </span>
                  )}
                </div>
                <label htmlFor="notifyEmail" className="block text-[11px] text-slate-400">
                  Receive a detailed request breakdown to your email using Resend and React Email.
                </label>
                <div className="relative mt-1.5">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail className="h-3.5 w-3.5 text-slate-500" />
                  </div>
                  <input
                    id="notifyEmail"
                    name="notifyEmail"
                    type="email"
                    disabled={!tierInfo.isPremium}
                    placeholder={tierInfo.isPremium ? "developer@example.com" : "Upgrade to Premium to enable"}
                    className={clsx(
                      "block w-full rounded-lg border border-slate-800 bg-slate-950 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none",
                      !tierInfo.isPremium && "opacity-50 cursor-not-allowed"
                    )}
                  />
                </div>
              </div>

              <div className="pt-2">
                <SubmitButton />
              </div>
            </form>
          </section>

          {/* Webhook endpoint list and real-time logs */}
          <section className="lg:col-span-7 space-y-6">

            {/* Endpoints Roster list */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl font-sans">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-2 border-b border-slate-800">
                <h2 className="text-md font-bold text-white flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-400" />
                  Active Custom Endpoints ({webhooks.length})
                </h2>

                {webhooks.length > 0 && (
                  <button
                    onClick={handleSelectAllWebhooks}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                  >
                    {selectedSlugs.length === webhooks.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>

              {/* Bulk Operations Toolbar */}
              {selectedSlugs.length > 0 && (
                <div className="bg-indigo-950/40 border border-indigo-800/80 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 mb-4 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
                    <span className="text-xs text-indigo-300 font-bold">{selectedSlugs.length} selected</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {/* Status Changer */}
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleBulkStatusUpdate(Number(e.target.value));
                          e.target.value = "";
                        }
                      }}
                      className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300"
                    >
                      <option value="">Bulk Status</option>
                      <option value="200">Set 200 OK</option>
                      <option value="201">Set 201 Created</option>
                      <option value="204">Set 204 No Content</option>
                      <option value="500">Set 500 Server Error</option>
                    </select>

                    <button
                      onClick={handleBulkExport}
                      className="p-1.5 bg-slate-900 text-slate-200 border border-slate-800 rounded-lg hover:bg-slate-800 text-xs flex items-center gap-1 cursor-pointer"
                      title="Export Configurations"
                    >
                      <FileDown className="h-3.5 w-3.5" /> Export
                    </button>

                    <button
                      onClick={handleBulkDelete}
                      className="p-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg hover:bg-rose-500/20 text-xs flex items-center gap-1 cursor-pointer"
                      title="Bulk Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-6 text-slate-400">
                  <RefreshCw className="h-6 w-6 animate-spin text-indigo-500 mr-2" />
                  Loading active endpoints...
                </div>
              ) : webhooks.length === 0 ? (
                <div className="text-center py-8 bg-slate-950/40 rounded-xl border border-slate-800/60">
                  <Code className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-300">No active endpoints found</p>
                  <p className="text-xs text-slate-500 mt-1">Define your first webhook on the left to start receiving webhooks!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto font-sans pr-1">
                  {webhooks.map((wh) => {
                    const isSelected = selectedSlug === wh.slug;
                    const isChecked = selectedSlugs.includes(wh.slug);
                    return (
                      <div
                        key={wh.slug}
                        onClick={() => setSelectedSlug(wh.slug)}
                        className={clsx(
                          "cursor-pointer p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all",
                          isSelected
                            ? "bg-indigo-600/10 border-indigo-500"
                            : "bg-slate-950/40 border-slate-800/80 hover:bg-slate-900"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {/* Multi-select check */}
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => handleToggleSelectWebhook(wh.slug)}
                            className="h-4 w-4 rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                          />

                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white">{wh.name}</span>
                              <span className={clsx(
                                "text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase",
                                wh.method === "ALL" ? "bg-amber-500/10 text-amber-400" : "bg-indigo-500/10 text-indigo-400"
                              )}>
                                {wh.method}
                              </span>
                              {wh.cronSchedule && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold flex items-center gap-1" title="Cron trigger schedule">
                                  <Clock className="h-2.5 w-2.5" /> CRON: {wh.cronSchedule}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                              <span className="font-mono bg-slate-950 p-1 rounded border border-slate-800/80 max-w-[150px] truncate sm:max-w-none">
                                /api/webhooks/{wh.slug}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(`${origin}/api/webhooks/${wh.slug}`);
                                }}
                                className="text-slate-500 hover:text-white p-1 hover:scale-110 transition-transform"
                                title="Copy Full URL"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                          {isSelected && (
                            <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                          )}
                          {/* Health status indicator */}
                          {renderHealthBadge(wh)}
                          <span className="text-[11px] bg-slate-950 px-2 py-1 rounded text-slate-400 border border-slate-800 font-bold font-mono">
                            Returns {wh.status}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteWebhook(wh.slug);
                            }}
                            className="p-1.5 bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/20 hover:bg-rose-500/20 transition-colors cursor-pointer"
                            title="Delete Endpoint"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected Webhook Log Inspector Console & Interactive Playground Tabs */}
            {selectedWebhook ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden font-sans">
                {/* Tab Navigation header */}
                <div className="border-b border-slate-800 bg-slate-950/40 p-1 flex flex-wrap gap-1">
                  <button
                    onClick={() => setActiveTab("logs")}
                    className={clsx(
                      "flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer",
                      activeTab === "logs"
                        ? "bg-slate-900 text-white border border-slate-800"
                        : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <Activity className="h-4 w-4 text-indigo-400" />
                    Captured Executions
                  </button>

                  <button
                    onClick={() => setActiveTab("playground")}
                    className={clsx(
                      "flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer",
                      activeTab === "playground"
                        ? "bg-slate-900 text-white border border-slate-800"
                        : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <Play className="h-4 w-4 text-emerald-400" />
                    Interactive Playground & Docs
                  </button>

                  <button
                    onClick={() => setActiveTab("dlq")}
                    className={clsx(
                      "flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer relative",
                      activeTab === "dlq"
                        ? "bg-slate-900 text-white border border-slate-800"
                        : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <Flame className="h-4 w-4 text-rose-400" />
                    Dead Letter Queue (DLQ)
                    {dlqLogs.length > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-extrabold text-white animate-pulse">
                        {dlqLogs.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* TAB 1: LOGS INSPECTOR */}
                {activeTab === "logs" && (
                  <div>
                    <div className="p-6 border-b border-slate-800 bg-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-md font-bold text-white flex items-center gap-2">
                          Execution Inspector: {selectedWebhook.name}
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">
                          Showing real-time execution logs for endpoint: <code className="text-indigo-300 font-mono">/api/webhooks/{selectedWebhook.slug}</code>
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5 self-start sm:self-center shrink-0">
                        <button
                          onClick={handleTestWebhook}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-all cursor-pointer"
                          title="Simulate Request"
                        >
                          <Play className="h-3 w-3" />
                          Quick Test
                        </button>
                        <button
                          onClick={() => handleClearLogs(selectedWebhook.slug)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg hover:bg-rose-500/20 transition-all cursor-pointer"
                        >
                          Clear Logs
                        </button>
                      </div>
                    </div>

                    {/* Logs lists */}
                    <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
                      {loadingLogs ? (
                        <div className="flex items-center justify-center py-12 text-slate-400">
                          <RefreshCw className="h-6 w-6 animate-spin text-indigo-500 mr-2" />
                          Loading executions...
                        </div>
                      ) : logs.length === 0 ? (
                        <div className="text-center py-12 bg-slate-950/30 rounded-xl border border-slate-800/40">
                          <Clock className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                          <p className="text-sm font-semibold text-slate-300">No requests captured yet</p>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                            Use the "Quick Test" button above to send a mock request, or trigger it manually using curl/Postman.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {logs.map((lg) => {
                            const isExpanded = expandedLogId === lg._id;
                            const isDlq = lg.deliveryStatus === "DLQ";
                            const isDeduplicated = lg.isDuplicate;
                            return (
                              <div
                                key={lg._id}
                                className={clsx(
                                  "bg-slate-950 rounded-xl border overflow-hidden transition-all",
                                  isDlq ? "border-rose-500/30" : "border-slate-800"
                                )}
                              >
                                {/* Summary trigger line */}
                                <div
                                  onClick={() => setExpandedLogId(isExpanded ? null : lg._id || null)}
                                  className="cursor-pointer p-4 flex items-center justify-between hover:bg-slate-900/60 transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <span className={clsx(
                                      "text-[10px] px-2 py-0.5 rounded font-mono font-extrabold uppercase",
                                      lg.method === "POST" ? "bg-emerald-500/10 text-emerald-400" : "bg-sky-500/10 text-sky-400"
                                    )}>
                                      {lg.method}
                                    </span>
                                    <div className="text-xs font-sans">
                                      <span className="font-semibold text-slate-300">{lg.clientIp}</span>
                                      <span className="text-slate-500 mx-2">•</span>
                                      <span className="text-slate-400">{new Date(lg.timestamp).toLocaleString()}</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {isDeduplicated && (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-bold">
                                        DEDUPLICATED
                                      </span>
                                    )}
                                    {lg.emailNotified && (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">
                                        <Mail className="h-3 w-3" /> Email Alert
                                      </span>
                                    )}
                                    {lg.forwardedUrl && (
                                      <span className={clsx(
                                        "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-bold",
                                        lg.deliveryStatus === "SUCCESS"
                                          ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                          : lg.deliveryStatus === "DLQ"
                                            ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
                                            : "text-amber-400 bg-amber-500/10 border-amber-500/20 animate-pulse"
                                      )}>
                                        Proxy: {lg.deliveryStatus}
                                      </span>
                                    )}
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4 text-slate-500" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-slate-500" />
                                    )}
                                  </div>
                                </div>

                                {/* Detailed request headers & body expander */}
                                {isExpanded && (
                                  <div className="p-4 border-t border-slate-800 bg-slate-950/60 space-y-4 text-xs font-mono">
                                    {/* Idempotency Key */}
                                    {lg.idempotencyKeyUsed && (
                                      <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                                        <span>Idempotency Key used: <code className="text-amber-400 font-mono">{lg.idempotencyKeyUsed}</code></span>
                                        {isDeduplicated && <span className="text-amber-400 text-[10px] font-bold">Returned Cached response</span>}
                                      </div>
                                    )}

                                    {/* Delay applied */}
                                    {lg.delayAppliedMs && (
                                      <div className="text-[11px] text-indigo-400 bg-indigo-500/5 px-2.5 py-1.5 rounded border border-indigo-500/10 flex items-center gap-1 font-sans font-bold">
                                        <Clock className="h-3.5 w-3.5 animate-pulse" /> Artificial delay of {lg.delayAppliedMs}ms applied before response.
                                      </div>
                                    )}

                                    {/* Query parameters */}
                                    {Object.keys(lg.query).length > 0 && (
                                      <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-sans">Query Params</p>
                                        <pre className="bg-slate-900/80 p-3 rounded border border-slate-800 text-slate-300 overflow-x-auto text-[11px] font-mono">
                                          {JSON.stringify(lg.query, null, 2)}
                                        </pre>
                                      </div>
                                    )}

                                    {/* Headers */}
                                    <div>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-sans">HTTP Headers</p>
                                      <pre className="bg-slate-900/80 p-3 rounded border border-slate-800 text-slate-300 overflow-x-auto text-[11px] font-mono max-h-[150px] overflow-y-auto">
                                        {JSON.stringify(lg.headers, null, 2)}
                                      </pre>
                                    </div>

                                    {/* Body payload */}
                                    <div>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-sans">Payload (Request Body)</p>
                                      <pre className="bg-slate-900/80 p-3 rounded border border-slate-800 text-slate-300 overflow-x-auto text-[11px] font-mono">
                                        {lg.body || "(empty)"}
                                      </pre>
                                    </div>

                                    {/* Transformation Output */}
                                    {lg.transformedBody && (
                                      <div>
                                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1 font-sans flex items-center gap-1">
                                          <Sparkle className="h-3.5 w-3.5 text-indigo-400" /> Transformed Payload (Script Output)
                                        </p>
                                        <pre className="bg-indigo-950/20 p-3 rounded border border-indigo-500/20 text-slate-300 overflow-x-auto text-[11px] font-mono">
                                          {lg.transformedBody}
                                        </pre>
                                      </div>
                                    )}

                                    {/* Proxy Deliveries attempts table */}
                                    {lg.forwardedUrl && lg.deliveries && (
                                      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 font-sans space-y-2">
                                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Proxy Forwarding Deliveries & Retries</p>
                                        <div className="text-xs text-slate-400 mb-2">
                                          Target: <code className="text-indigo-400 font-mono">{lg.forwardedUrl}</code>
                                        </div>

                                        <div className="space-y-2">
                                          {lg.deliveries.map((attempt) => (
                                            <div key={attempt.attempt} className="flex items-center justify-between text-xs border-b border-slate-800/40 pb-2">
                                              <span className="text-slate-400 font-mono">Attempt {attempt.attempt}</span>
                                              <span className="text-[11px] text-slate-500">{new Date(attempt.timestamp).toLocaleTimeString()}</span>
                                              <div className="flex items-center gap-2">
                                                {attempt.statusCode && (
                                                  <span className="font-mono bg-slate-950 px-1.5 py-0.5 rounded text-[11px]">
                                                    Status: {attempt.statusCode}
                                                  </span>
                                                )}
                                                <span className={clsx(
                                                  "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                                  attempt.status === "SUCCESS" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                                                )}>
                                                  {attempt.status}
                                                </span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>

                                        {lg.deliveryStatus === "DLQ" && (
                                          <div className="flex items-center justify-between bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg mt-3">
                                            <div>
                                              <span className="text-xs text-rose-300 font-bold block">Delivery Failed. Enqueued to DLQ.</span>
                                              <span className="text-[11px] text-slate-400">{lg.forwardResponse || "No error log."}</span>
                                            </div>
                                            <button
                                              onClick={() => lg._id && handleRedriveDLQ(lg._id)}
                                              className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                                            >
                                              Re-drive Now
                                            </button>
                                          </div>
                                        )}
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

                {/* TAB 2: INTERACTIVE PLAYGROUND & DOCS */}
                {activeTab === "playground" && (
                  <div className="p-6 space-y-6 font-sans text-slate-300">
                    <div>
                      <h2 className="text-md font-bold text-white flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-emerald-400" />
                        Interactive API Docs & Live Playground
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Use this test harness to fire real webhooks to this endpoint right from the browser. You can modify custom headers, query params, and body payloads.
                      </p>
                    </div>

                    {/* API URL Specs */}
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span className={clsx(
                          "px-2.5 py-1 rounded font-bold uppercase text-white bg-indigo-600"
                        )}>
                          {selectedWebhook.method === "ALL" ? "ANY METHOD" : selectedWebhook.method}
                        </span>
                        <code className="text-indigo-300 break-all select-all bg-slate-900/60 p-1.5 rounded border border-slate-800/80">
                          {origin}/api/webhooks/{selectedWebhook.slug}
                        </code>
                        <button
                          onClick={() => copyToClipboard(`${origin}/api/webhooks/${selectedWebhook.slug}`)}
                          className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded border border-slate-800 cursor-pointer"
                          title="Copy Full URL"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="text-slate-400 text-[11px] space-y-1">
                        <p>• Content-Type response: <code className="text-slate-300">{selectedWebhook.contentType}</code></p>
                        <p>• Status code returned: <code className="text-slate-300">{selectedWebhook.status}</code></p>
                        {selectedWebhook.forwardUrl && (
                          <p>• Forward target proxy: <code className="text-indigo-400">{selectedWebhook.forwardUrl}</code></p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                      {/* Request inputs */}
                      <div className="space-y-4">
                        {/* Headers */}
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            HTTP Headers (JSON)
                          </label>
                          <textarea
                            value={pgHeaders}
                            onChange={(e) => setPgHeaders(e.target.value)}
                            rows={4}
                            className="block w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-[11px] font-mono text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        {/* Query parameters */}
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            URL Query Parameters (JSON)
                          </label>
                          <textarea
                            value={pgQuery}
                            onChange={(e) => setPgQuery(e.target.value)}
                            rows={3}
                            className="block w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-[11px] font-mono text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        {/* Request Body Payload */}
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            JSON Body Payload
                          </label>
                          <textarea
                            value={pgBody}
                            onChange={(e) => setPgBody(e.target.value)}
                            rows={5}
                            className="block w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-[11px] font-mono text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        <button
                          onClick={handlePlaygroundSend}
                          disabled={pgLoading}
                          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl transition-all cursor-pointer"
                        >
                          {pgLoading ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" /> Firing Request...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4" /> Trigger Playground Webhook
                            </>
                          )}
                        </button>
                      </div>

                      {/* Playground Response */}
                      <div className="space-y-4">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Playground Live Response Code
                        </label>

                        {pgResponse ? (
                          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden font-mono text-xs">
                            <div className="bg-slate-900/80 p-3.5 border-b border-slate-800 flex items-center justify-between">
                              <span className="font-bold flex items-center gap-2">
                                Status:
                                <span className={clsx(
                                  "px-2 py-0.5 rounded font-extrabold",
                                  pgResponse.status >= 200 && pgResponse.status < 300 ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                                )}>
                                  {pgResponse.status}
                                </span>
                              </span>
                              <span className="text-[10px] text-slate-500">Live response from route</span>
                            </div>

                            <div className="p-4 space-y-4">
                              {/* Response headers */}
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Response Headers</p>
                                <pre className="text-[10px] text-slate-300 bg-slate-900 p-2.5 rounded border border-slate-800/80 overflow-x-auto max-h-[120px] overflow-y-auto">
                                  {JSON.stringify(pgResponse.headers, null, 2)}
                                </pre>
                              </div>

                              {/* Response body */}
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Response Body</p>
                                <pre className="text-[11px] text-slate-300 bg-slate-900 p-2.5 rounded border border-slate-800/80 overflow-x-auto max-h-[200px] overflow-y-auto">
                                  {pgResponse.body || "(empty response)"}
                                </pre>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="border border-dashed border-slate-800 rounded-xl p-12 text-center text-slate-500 text-xs">
                            <Activity className="h-8 w-8 text-slate-600 mx-auto mb-2 animate-pulse" />
                            Once you trigger the webhook, the live client-side HTTP response will display here.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: DEAD LETTER QUEUE */}
                {activeTab === "dlq" && (
                  <div className="p-6 space-y-4">
                    <div>
                      <h2 className="text-md font-bold text-white flex items-center gap-2">
                        <Flame className="h-5 w-5 text-rose-400 animate-pulse" />
                        Dead Letter Queue (DLQ) Deliveries
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Any forwarding deliveries that exhaust all automatic exponential backoff retry attempts end up in the DLQ. You can inspect failures and manually re-drive them.
                      </p>
                    </div>

                    {loadingDLQ ? (
                      <div className="text-center py-6 text-slate-400">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mr-2 inline" /> Loading DLQ entries...
                      </div>
                    ) : dlqLogs.length === 0 ? (
                      <div className="border border-dashed border-slate-800 rounded-xl p-8 text-center text-slate-500 text-xs">
                        <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                        No failed deliveries in DLQ! All proxy deliveries are operating perfectly.
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 font-sans">
                        {dlqLogs.map((log) => (
                          <div key={log._id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-slate-900/50 transition-colors">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded border border-rose-500/20">
                                  FAILED_DLQ
                                </span>
                                <span className="text-xs font-mono font-bold text-white">/api/webhooks/{log.webhookSlug}</span>
                              </div>
                              <p className="text-[11px] text-slate-400">
                                Target Proxy URL: <code className="text-indigo-400 font-mono text-[11px]">{log.forwardedUrl}</code>
                              </p>
                              <p className="text-[10px] text-slate-500">
                                Triggered: {new Date(log.timestamp).toLocaleString()} • All {log.deliveries?.length || 3} retries failed
                              </p>
                              <div className="text-[11px] bg-rose-950/20 text-rose-300 p-2 rounded border border-rose-500/10 max-w-[500px] truncate">
                                Error: {log.forwardResponse || "Network delivery timeout"}
                              </div>
                            </div>

                            <button
                              onClick={() => log._id && handleRedriveDLQ(log._id)}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                            >
                              <RotateCw className="h-3.5 w-3.5" /> Re-drive Replay
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}

          </section>

        </div>

      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={clsx(
        "w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer",
        pending && "opacity-50 cursor-not-allowed"
      )}
    >
      {pending ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" />
          Configuring endpoint...
        </>
      ) : (
        <>
          <Plus className="h-4 w-4" />
          Create Dynamic Endpoint
        </>
      )}
    </button>
  );
}
