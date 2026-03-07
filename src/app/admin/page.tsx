"use client";

import { useState, useEffect, useCallback } from "react";

interface OverviewData {
  sessions_today: number;
  sessions_week: number;
  sessions_month: number;
  auth_events_month: number;
  total_messages: number;
  total_csv_downloads: number;
}

interface UserActivity {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  total_messages: number;
  last_active: string | null;
  preferred_model: string | null;
}

interface FeatureUsage {
  chart_types: { name: string; count: number }[];
  timeframes: { name: string; count: number }[];
  candle_intervals: { name: string; count: number }[];
  ema_toggles: { name: string; count: number }[];
  model_switches: { name: string; count: number }[];
}

interface AnalyticsEvent {
  id: string;
  event_name: string;
  properties: Record<string, unknown>;
  session_id: string | null;
  user_id: string | null;
  page_path: string;
  referrer: string | null;
  created_at: string;
}

interface DashboardData {
  overview: OverviewData | null;
  featureUsage: FeatureUsage | null;
  referrers: { source: string; count: number }[];
  userActivity: UserActivity[];
  recentEvents: AnalyticsEvent[];
  totalUsers: number;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function UsageBar({ items }: { items: { name: string; count: number }[] }) {
  if (!items || items.length === 0) return <span className="text-terminal-muted/50 text-[10px]">No data</span>;
  const max = Math.max(...items.map((i) => i.count));
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <div key={item.name} className="flex items-center gap-2 text-[10px]">
          <span className="w-16 text-terminal-muted truncate text-right">{item.name}</span>
          <div className="flex-1 h-2.5 bg-white/5 rounded-sm overflow-hidden">
            <div
              className="h-full bg-terminal-green/60 rounded-sm"
              style={{ width: `${max > 0 ? (item.count / max) * 100 : 0}%` }}
            />
          </div>
          <span className="w-8 text-white tabular-nums text-right">{item.count}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/analytics");
      if (res.status === 401 || res.status === 403) {
        setError("ACCESS DENIED");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError(`Error: ${res.status}`);
        setLoading(false);
        return;
      }
      const json = await res.json();
      setData(json);
      setError(null);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch {
      setError("Failed to fetch analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-white text-sm">
          Loading analytics<span className="cursor-blink">_</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="text-terminal-red text-lg font-bold mb-2">{error}</div>
          {error === "ACCESS DENIED" && (
            <div className="text-terminal-muted text-[11px]">
              Admin privileges required.{" "}
              <a href="/" className="text-terminal-green hover:underline">Return to terminal</a>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const ov = data.overview;
  const authRate = ov && ov.sessions_month > 0
    ? ((ov.auth_events_month / ov.sessions_month) * 100).toFixed(1)
    : "0";

  return (
    <div className="min-h-screen bg-[#0a0a0a] noise-bg">
      {/* Header */}
      <header className="flex items-center gap-4 px-4 py-2 border-b border-terminal-border bg-[#0a0a0a]">
        <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-white">
          Admin Analytics
        </span>
        <div className="w-px h-4 bg-terminal-border" />
        <span className="inline-block w-2 h-2 rounded-full bg-terminal-green pulse-live" />
        <span className="text-[9px] text-terminal-muted uppercase">Live</span>

        <div className="ml-auto flex items-center gap-3">
          {lastRefresh && (
            <span className="text-[9px] text-terminal-muted">
              Updated {lastRefresh}
            </span>
          )}
          <button
            onClick={() => { setLoading(true); fetchData(); }}
            className="text-[9px] text-terminal-muted hover:text-white transition-colors uppercase tracking-wider"
          >
            Refresh
          </button>
          <div className="w-px h-3 bg-terminal-border" />
          <a href="/" className="text-[9px] text-terminal-muted hover:text-white transition-colors uppercase tracking-wider">
            Terminal
          </a>
        </div>
      </header>

      <div className="p-4 space-y-3">
        {/* Overview Strip */}
        <div className="grid grid-cols-6 gap-3">
          {[
            { label: "Sessions Today", value: ov?.sessions_today ?? 0 },
            { label: "Sessions (7d)", value: ov?.sessions_week ?? 0 },
            { label: "Sessions (30d)", value: ov?.sessions_month ?? 0 },
            { label: "Auth Rate (30d)", value: `${authRate}%` },
            { label: "Total Messages", value: ov?.total_messages ?? 0 },
            { label: "Total Users", value: data.totalUsers },
          ].map((stat) => (
            <div key={stat.label} className="terminal-panel glow-border p-3">
              <div className="text-[8px] tracking-[0.2em] uppercase text-terminal-muted mb-1">
                {stat.label}
              </div>
              <div className="text-xl font-bold text-white glow-text tabular-nums">
                {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-3 gap-3">
          {/* User Activity — 2 cols */}
          <div className="col-span-2 terminal-panel">
            <div className="terminal-panel-header">
              <span className="inline-block w-2 h-2 rounded-full bg-terminal-green pulse-live" />
              <span>User Activity</span>
              <span className="ml-auto text-terminal-muted font-normal text-[9px]">
                {data.userActivity?.length ?? 0} users
              </span>
            </div>
            <div className="overflow-y-auto max-h-[280px]">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-terminal-muted tracking-[0.15em] uppercase border-b border-terminal-border/30">
                    <th className="text-left px-3 py-1.5 font-semibold">Email</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Messages</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Last Active</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Model</th>
                  </tr>
                </thead>
                <tbody>
                  {data.userActivity && data.userActivity.length > 0 ? (
                    data.userActivity.map((u, i) => (
                      <tr
                        key={u.id}
                        className={`border-b border-terminal-border/10 ${
                          i % 2 === 0 ? "" : "bg-white/[0.02]"
                        }`}
                      >
                        <td className="px-3 py-1.5 text-terminal-text truncate max-w-[200px]">
                          {u.email}
                        </td>
                        <td className="px-3 py-1.5 text-right text-white tabular-nums">
                          {u.total_messages}
                        </td>
                        <td className="px-3 py-1.5 text-right text-terminal-muted">
                          {timeAgo(u.last_active)}
                        </td>
                        <td className="px-3 py-1.5 text-right text-terminal-muted">
                          {u.preferred_model
                            ? u.preferred_model.includes("opus")
                              ? "Opus"
                              : "Sonnet"
                            : "—"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-terminal-muted">
                        No user activity yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Referrer Sources — 1 col */}
          <div className="col-span-1 terminal-panel">
            <div className="terminal-panel-header">
              <span>Traffic Sources</span>
              <span className="ml-auto text-terminal-muted font-normal text-[9px]">30d</span>
            </div>
            <div className="p-3 space-y-1.5 max-h-[280px] overflow-y-auto">
              {data.referrers && data.referrers.length > 0 ? (
                data.referrers.map((r) => (
                  <div key={r.source} className="flex items-center justify-between text-[10px]">
                    <span className="text-terminal-text truncate">{r.source}</span>
                    <span className="text-white tabular-nums ml-2">{r.count}</span>
                  </div>
                ))
              ) : (
                <div className="text-terminal-muted text-[10px] text-center py-4">
                  No referrer data yet
                </div>
              )}
            </div>
          </div>

          {/* Feature Usage — 2 cols */}
          <div className="col-span-2 terminal-panel">
            <div className="terminal-panel-header">
              <span>Feature Usage</span>
            </div>
            <div className="p-3 grid grid-cols-2 gap-4">
              <div>
                <div className="text-[8px] tracking-[0.2em] uppercase text-terminal-muted mb-2">Chart Types</div>
                <UsageBar items={data.featureUsage?.chart_types ?? []} />
              </div>
              <div>
                <div className="text-[8px] tracking-[0.2em] uppercase text-terminal-muted mb-2">Timeframes</div>
                <UsageBar items={data.featureUsage?.timeframes ?? []} />
              </div>
              <div>
                <div className="text-[8px] tracking-[0.2em] uppercase text-terminal-muted mb-2">Candle Intervals</div>
                <UsageBar items={data.featureUsage?.candle_intervals ?? []} />
              </div>
              <div>
                <div className="text-[8px] tracking-[0.2em] uppercase text-terminal-muted mb-2">Models</div>
                <UsageBar items={data.featureUsage?.model_switches ?? []} />
              </div>
              <div>
                <div className="text-[8px] tracking-[0.2em] uppercase text-terminal-muted mb-2">EMA Overlays</div>
                <UsageBar items={data.featureUsage?.ema_toggles ?? []} />
              </div>
              <div>
                <div className="text-[8px] tracking-[0.2em] uppercase text-terminal-muted mb-2">Downloads</div>
                <div className="text-white text-lg font-bold tabular-nums">
                  {ov?.total_csv_downloads ?? 0}
                  <span className="text-[10px] text-terminal-muted font-normal ml-1">CSVs</span>
                </div>
              </div>
            </div>
          </div>

          {/* Event Feed — 1 col */}
          <div className="col-span-1 terminal-panel">
            <div className="terminal-panel-header">
              <span className="inline-block w-2 h-2 rounded-full bg-terminal-green pulse-live" />
              <span>Event Feed</span>
              <span className="ml-auto text-terminal-muted font-normal text-[9px]">
                Latest 50
              </span>
            </div>
            <div className="overflow-y-auto max-h-[300px] p-1">
              {data.recentEvents && data.recentEvents.length > 0 ? (
                data.recentEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-start gap-2 px-2 py-1 text-[9px] border-b border-terminal-border/10 hover:bg-white/[0.02]"
                  >
                    <span className="text-terminal-green/60 shrink-0 tabular-nums">
                      {formatTime(ev.created_at)}
                    </span>
                    <span className={`shrink-0 ${
                      ev.event_name === "session_start" ? "text-terminal-green" :
                      ev.event_name === "chat_message_sent" ? "text-white" :
                      ev.event_name === "auth_complete" ? "text-[#4488ff]" :
                      ev.event_name === "model_switch" ? "text-[#ff8844]" :
                      "text-terminal-muted"
                    }`}>
                      {ev.event_name}
                    </span>
                    <span className="text-terminal-muted/50 truncate">
                      {ev.user_id ? ev.user_id.slice(0, 8) : ev.session_id?.slice(0, 8) ?? "—"}
                    </span>
                  </div>
                ))
              ) : (
                <div className="px-2 py-4 text-center text-terminal-muted text-[10px]">
                  No events yet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
