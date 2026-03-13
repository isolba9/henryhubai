"use client";

import { useState, useEffect, useCallback } from "react";

/* ── Types ── */

interface TrendPoint {
  date: string;
  avg_sentiment: number;
  post_count: number;
  comment_count: number;
}

interface Keyword {
  word: string;
  count: number;
}

interface Overview {
  avg_sentiment: number;
  total_posts: number;
  total_comments: number;
  bullish_pct: number;
  bearish_pct: number;
  neutral_pct: number;
}

interface SentimentData {
  trend: TrendPoint[];
  keywords: Keyword[];
  overview: Overview;
}

/* ── Constants ── */

const TIME_RANGES = [
  { label: "7D", value: 7 },
  { label: "30D", value: 30 },
  { label: "90D", value: 90 },
] as const;

const SUBREDDITS = [
  { label: "All Subreddits", value: "all" },
  { label: "r/naturalgas", value: "naturalgas" },
  { label: "r/energy", value: "energy" },
  { label: "r/commodities", value: "commodities" },
  { label: "r/natgas", value: "natgas" },
  { label: "r/oil", value: "oil" },
] as const;

/* ── Helpers ── */

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function sentimentColor(val: number): string {
  if (val > 0.1) return "#00ff88";
  if (val < -0.1) return "#ff4444";
  return "#888888";
}

/* ── SVG Sentiment Trend Chart ── */

function SentimentChart({ trend }: { trend: TrendPoint[] }) {
  if (trend.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-terminal-muted text-[11px]">
        No sentiment data available
      </div>
    );
  }

  const W = 600;
  const H = 200;
  const PAD_L = 40;
  const PAD_R = 10;
  const PAD_T = 15;
  const PAD_B = 25;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const xStep = trend.length > 1 ? plotW / (trend.length - 1) : 0;
  const yScale = (v: number) => PAD_T + ((1 - v) / 2) * plotH;

  const points = trend
    .map((d, i) => `${PAD_L + i * xStep},${yScale(d.avg_sentiment)}`)
    .join(" ");

  // Area fill polygon
  const areaPoints = [
    `${PAD_L},${yScale(0)}`,
    ...trend.map((d, i) => `${PAD_L + i * xStep},${yScale(d.avg_sentiment)}`),
    `${PAD_L + (trend.length - 1) * xStep},${yScale(0)}`,
  ].join(" ");

  // X-axis labels — show ~6 labels max
  const labelInterval = Math.max(1, Math.floor(trend.length / 6));

  // Y-axis gridlines
  const yLines = [-1, -0.5, 0, 0.5, 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {/* Grid lines */}
      {yLines.map((v) => (
        <g key={v}>
          <line
            x1={PAD_L}
            y1={yScale(v)}
            x2={W - PAD_R}
            y2={yScale(v)}
            stroke={v === 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)"}
            strokeDasharray={v === 0 ? "none" : "3,3"}
          />
          <text
            x={PAD_L - 5}
            y={yScale(v) + 3}
            textAnchor="end"
            fill="#666"
            fontSize="9"
            fontFamily="inherit"
          >
            {v > 0 ? `+${v}` : v}
          </text>
        </g>
      ))}

      {/* Area fill */}
      <polygon points={areaPoints} fill="rgba(0,255,136,0.06)" />

      {/* Trend line */}
      <polyline
        points={points}
        fill="none"
        stroke="#00ff88"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Data points */}
      {trend.map((d, i) => (
        <circle
          key={i}
          cx={PAD_L + i * xStep}
          cy={yScale(d.avg_sentiment)}
          r="3"
          fill={sentimentColor(d.avg_sentiment)}
          stroke="#0a0a0a"
          strokeWidth="1"
        />
      ))}

      {/* X-axis labels */}
      {trend.map((d, i) =>
        i % labelInterval === 0 || i === trend.length - 1 ? (
          <text
            key={i}
            x={PAD_L + i * xStep}
            y={H - 4}
            textAnchor="middle"
            fill="#666"
            fontSize="9"
            fontFamily="inherit"
          >
            {formatDate(d.date)}
          </text>
        ) : null
      )}
    </svg>
  );
}

/* ── Discussion Volume Bar Chart ── */

function VolumeChart({ trend }: { trend: TrendPoint[] }) {
  if (trend.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-terminal-muted text-[11px]">
        No discussion data available
      </div>
    );
  }

  const maxVol = Math.max(...trend.map((d) => d.post_count + d.comment_count), 1);
  const labelInterval = Math.max(1, Math.floor(trend.length / 6));

  return (
    <div>
      <div className="flex items-end gap-px h-[170px] px-1">
        {trend.map((d, i) => {
          const total = d.post_count + d.comment_count;
          const pct = (total / maxVol) * 100;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col justify-end group relative"
            >
              <div
                className="bg-[#00ff88]/50 hover:bg-[#00ff88]/80 transition-colors rounded-t-sm min-h-[1px]"
                style={{ height: `${pct}%` }}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-[#1a1a2e] border border-terminal-border rounded px-2 py-1 text-[9px] text-white whitespace-nowrap z-10">
                {formatDate(d.date)}: {total} discussions
              </div>
            </div>
          );
        })}
      </div>
      {/* X-axis labels */}
      <div className="flex gap-px px-1 mt-1">
        {trend.map((d, i) => (
          <div key={i} className="flex-1 text-center">
            {i % labelInterval === 0 || i === trend.length - 1 ? (
              <span className="text-[9px] text-terminal-muted">
                {formatDate(d.date)}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Top Keywords ── */

function KeywordBars({ keywords }: { keywords: Keyword[] }) {
  if (keywords.length === 0) {
    return (
      <div className="text-terminal-muted text-[11px] py-4 text-center">
        No keyword data yet
      </div>
    );
  }

  const max = Math.max(...keywords.map((k) => k.count));

  return (
    <div className="flex flex-wrap gap-2 px-1">
      {keywords.map((kw) => (
        <div
          key={kw.word}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-terminal-border bg-white/[0.02] text-[10px]"
        >
          <span className="text-terminal-text">{kw.word}</span>
          <span className="text-terminal-muted">({kw.count})</span>
        </div>
      ))}
    </div>
  );
}

/* ── Stat Card ── */

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="terminal-panel glow-border p-3">
      <div className="text-[8px] tracking-[0.2em] uppercase text-terminal-muted mb-1">
        {label}
      </div>
      <div
        className="text-xl font-bold tabular-nums"
        style={{ color: color || "#e0e0e0" }}
      >
        {value}
      </div>
    </div>
  );
}

/* ── Main Page ── */

export default function SentimentPage() {
  const [data, setData] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [subreddit, setSubreddit] = useState("all");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/sentiment?days=${days}&subreddit=${subreddit}`
      );
      if (!res.ok) throw new Error(`Error: ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [days, subreddit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const ov = data?.overview;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      {/* Controls */}
      <div className="terminal-panel">
        <div className="flex items-center gap-2 p-2 flex-wrap">
          {/* Time range */}
          {TIME_RANGES.map((t) => (
            <button
              key={t.value}
              onClick={() => setDays(t.value as 7 | 30 | 90)}
              className={`px-3 py-1 rounded-sm text-[10px] font-semibold tracking-wider uppercase transition-colors ${
                days === t.value
                  ? "bg-white/10 text-white"
                  : "text-terminal-muted hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}

          <div className="w-px h-4 bg-terminal-border mx-1" />

          {/* Subreddits */}
          {SUBREDDITS.map((s) => (
            <button
              key={s.value}
              onClick={() => setSubreddit(s.value)}
              className={`px-2 py-1 rounded-sm text-[10px] tracking-wider transition-colors ${
                subreddit === s.value
                  ? "bg-white/10 text-white font-semibold"
                  : "text-terminal-muted hover:text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="terminal-panel p-3 text-terminal-red text-[11px]">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="text-terminal-muted text-[11px] text-center py-12">
          Loading sentiment data<span className="cursor-blink">_</span>
        </div>
      )}

      {/* Overview Stats */}
      {ov && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Average Sentiment"
            value={
              ov.avg_sentiment > 0
                ? `+${ov.avg_sentiment.toFixed(3)}`
                : ov.avg_sentiment.toFixed(3)
            }
            color={sentimentColor(ov.avg_sentiment)}
          />
          <StatCard
            label="Total Discussions"
            value={String(ov.total_posts + ov.total_comments)}
          />
          <StatCard
            label="Bullish"
            value={`${ov.bullish_pct}%`}
            color="#00ff88"
          />
          <StatCard
            label="Bearish"
            value={`${ov.bearish_pct}%`}
            color="#ff4444"
          />
        </div>
      )}

      {/* Charts Row */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Sentiment Trend */}
          <div className="terminal-panel glow-border">
            <div className="terminal-panel-header">
              <span>Sentiment Trend</span>
              <span className="ml-auto text-terminal-muted font-normal text-[9px]">
                Average sentiment over time (-1 to +1)
              </span>
            </div>
            <div className="p-3">
              <SentimentChart trend={data.trend} />
            </div>
          </div>

          {/* Discussion Volume */}
          <div className="terminal-panel glow-border">
            <div className="terminal-panel-header">
              <span>Discussion Volume</span>
              <span className="ml-auto text-terminal-muted font-normal text-[9px]">
                Total posts and comments per day
              </span>
            </div>
            <div className="p-3">
              <VolumeChart trend={data.trend} />
            </div>
          </div>
        </div>
      )}

      {/* Top Keywords */}
      {data && (
        <div className="terminal-panel glow-border">
          <div className="terminal-panel-header">
            <span>Top Keywords</span>
            <span className="ml-auto text-terminal-muted font-normal text-[9px]">
              Most frequently mentioned terms from discussions
            </span>
          </div>
          <div className="p-3">
            <KeywordBars keywords={data.keywords} />
          </div>
          <div className="px-3 pb-2 text-[8px] text-terminal-muted/50">
            Keywords extracted from natural gas community discussions. Updated
            periodically during data ingestion.
          </div>
        </div>
      )}

      {/* Footer note */}
      <div className="text-center text-[9px] text-terminal-muted/40 py-2">
        Sentiment data is collected from natural gas community discussions and
        analysed using AI. Updated periodically.
      </div>
    </div>
  );
}
