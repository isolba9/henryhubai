"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  calculateEMA,
  generateDailyCandles,
  generateWeeklyCandles,
  getTimeframeFrom,
  type HistoryPoint,
  type CandlePoint,
} from "@/lib/chart-utils";

interface PriceData {
  name: string;
  price: number;
  currency: string;
  exchange: string;
  updated: number;
  timestamp: string;
}

interface StorageData {
  current: { period: string; value: number; unit: string };
  yearAgo: { value: number; diff: number; pctChange: number } | null;
  fiveYearAvg: { value: number; diff: number; pctChange: number } | null;
  timestamp: string;
}

interface RangeStats {
  high: number;
  low: number;
  change: number;
  pctChange: number;
  startDate: string;
  endDate: string;
}

interface OhlcOverlay {
  visible: boolean;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  prevClose: number | null;
  ema50: number | null;
  ema100: number | null;
  ema200: number | null;
}

type ChartType = "candlestick" | "bar" | "line";
type Timeframe = "1M" | "3M" | "6M" | "1Y" | "ALL";

const TIMEFRAMES: Timeframe[] = ["1M", "3M", "6M", "1Y", "ALL"];
const CHART_TYPES: { type: ChartType; label: string }[] = [
  { type: "candlestick", label: "Candle" },
  { type: "bar", label: "Bar" },
  { type: "line", label: "Line" },
];

export default function PricePanel() {
  const [price, setPrice] = useState<PriceData | null>(null);
  const [prevPrice, setPrevPrice] = useState<number | null>(null);
  const [storage, setStorage] = useState<StorageData | null>(null);
  const [historyData, setHistoryData] = useState<HistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [priceError, setPriceError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  // Chart settings
  const [chartType, setChartType] = useState<ChartType>("candlestick");
  const [timeframe, setTimeframe] = useState<Timeframe>("6M");
  const [showEma50, setShowEma50] = useState(false);
  const [showEma100, setShowEma100] = useState(false);
  const [showEma200, setShowEma200] = useState(false);
  const [rangeStats, setRangeStats] = useState<RangeStats | null>(null);
  const [ohlc, setOhlc] = useState<OhlcOverlay>({
    visible: false,
    time: "",
    open: 0,
    high: 0,
    low: 0,
    close: 0,
    prevClose: null,
    ema50: null,
    ema100: null,
    ema200: null,
  });

  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<unknown>(null);

  // Load preferences from localStorage
  useEffect(() => {
    try {
      const tf = localStorage.getItem("hh-tf") as Timeframe;
      if (tf && TIMEFRAMES.includes(tf)) setTimeframe(tf);
      const ct = localStorage.getItem("hh-ct") as ChartType;
      if (ct) setChartType(ct);
      if (localStorage.getItem("hh-e50") === "1") setShowEma50(true);
      if (localStorage.getItem("hh-e100") === "1") setShowEma100(true);
      if (localStorage.getItem("hh-e200") === "1") setShowEma200(true);
    } catch {}
  }, []);

  // Persist preferences
  useEffect(() => {
    try {
      localStorage.setItem("hh-tf", timeframe);
    } catch {}
  }, [timeframe]);
  useEffect(() => {
    try {
      localStorage.setItem("hh-ct", chartType);
    } catch {}
  }, [chartType]);
  useEffect(() => {
    try {
      localStorage.setItem("hh-e50", showEma50 ? "1" : "0");
    } catch {}
  }, [showEma50]);
  useEffect(() => {
    try {
      localStorage.setItem("hh-e100", showEma100 ? "1" : "0");
    } catch {}
  }, [showEma100]);
  useEffect(() => {
    try {
      localStorage.setItem("hh-e200", showEma200 ? "1" : "0");
    } catch {}
  }, [showEma200]);

  // --- Data Fetching ---

  const fetchHistory = useCallback(async (retry = false) => {
    try {
      setHistoryLoading(true);
      const res = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.data && data.data.length > 0) setHistoryData(data.data);
      setHistoryError("");
    } catch (err) {
      // Auto-retry once after 3s on failure
      if (!retry) {
        setTimeout(() => fetchHistory(true), 3000);
        return;
      }
      setHistoryError(
        err instanceof Error ? err.message : "History fetch failed"
      );
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const fetchPrice = useCallback(async () => {
    try {
      const res = await fetch("/api/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPrice((prev) => {
        if (prev) setPrevPrice(prev.price);
        return data;
      });
      setPriceError("");
      setLastUpdate(new Date().toLocaleTimeString());
      fetch("/api/supabase/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceData: data }),
      }).catch(() => {});
    } catch (err) {
      setPriceError(err instanceof Error ? err.message : "Price fetch failed");
    }
  }, []);

  const fetchStorage = useCallback(async () => {
    try {
      const res = await fetch("/api/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStorage(data);
      setStorageError("");
    } catch (err) {
      setStorageError(
        err instanceof Error ? err.message : "Storage fetch failed"
      );
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    fetchPrice();
    fetchStorage();
  }, [fetchHistory, fetchPrice, fetchStorage]);

  useEffect(() => {
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, [fetchPrice]);

  // --- Data Processing ---

  const sortedDaily = useMemo(() => {
    if (historyData.length === 0) return [];
    const sorted = [...historyData].sort((a, b) =>
      a.time < b.time ? -1 : a.time > b.time ? 1 : 0
    );
    if (price) {
      const today = new Date().toISOString().split("T")[0];
      const lastIdx = sorted.length - 1;
      if (sorted[lastIdx]?.time === today) {
        sorted[lastIdx] = { time: today, value: price.price };
      } else {
        sorted.push({ time: today, value: price.price });
      }
    }
    return sorted;
  }, [historyData, price]);

  const dailyCandles = useMemo(
    () => generateDailyCandles(sortedDaily),
    [sortedDaily]
  );
  const weeklyCandles = useMemo(
    () => generateWeeklyCandles(sortedDaily),
    [sortedDaily]
  );

  const ema50Data = useMemo(
    () => (showEma50 ? calculateEMA(sortedDaily, 50) : []),
    [sortedDaily, showEma50]
  );
  const ema100Data = useMemo(
    () => (showEma100 ? calculateEMA(sortedDaily, 100) : []),
    [sortedDaily, showEma100]
  );
  const ema200Data = useMemo(
    () => (showEma200 ? calculateEMA(sortedDaily, 200) : []),
    [sortedDaily, showEma200]
  );

  // EMA lookup maps for tooltip
  const ema50Map = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of ema50Data) m.set(d.time, d.value);
    return m;
  }, [ema50Data]);
  const ema100Map = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of ema100Data) m.set(d.time, d.value);
    return m;
  }, [ema100Data]);
  const ema200Map = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of ema200Data) m.set(d.time, d.value);
    return m;
  }, [ema200Data]);

  // Use daily candles for 1M/3M, weekly for longer
  const activeCandles = useMemo(
    () =>
      timeframe === "1M" || timeframe === "3M" ? dailyCandles : weeklyCandles,
    [timeframe, dailyCandles, weeklyCandles]
  );

  const hasChartData = activeCandles.length > 0;

  // Candle index map for fast tooltip lookup
  const candleIndexMap = useMemo(() => {
    const m = new Map<string, number>();
    activeCandles.forEach((c, i) => m.set(c.time, i));
    return m;
  }, [activeCandles]);

  // Find EMA value at or near a date (for weekly candles)
  const findEma = useCallback(
    (map: Map<string, number>, time: string): number | null => {
      if (map.has(time)) return map.get(time)!;
      const date = new Date(time + "T00:00:00");
      for (let i = 1; i <= 6; i++) {
        const d = new Date(date);
        d.setDate(date.getDate() + i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (map.has(key)) return map.get(key)!;
      }
      return null;
    },
    []
  );

  // --- Chart Controls ---

  const handleFitToTimeframe = useCallback(() => {
    const chart = chartInstanceRef.current as {
      timeScale: () => {
        fitContent: () => void;
        setVisibleRange: (r: unknown) => void;
      };
    } | null;
    if (!chart) return;
    if (timeframe === "ALL") {
      chart.timeScale().fitContent();
    } else {
      const fromStr = getTimeframeFrom(timeframe);
      const last = activeCandles[activeCandles.length - 1];
      if (last) {
        chart.timeScale().setVisibleRange({ from: fromStr, to: last.time });
      }
    }
  }, [timeframe, activeCandles]);

  const handleGoToLatest = useCallback(() => {
    const chart = chartInstanceRef.current as {
      timeScale: () => { scrollToRealTime: () => void };
    } | null;
    if (!chart) return;
    chart.timeScale().scrollToRealTime();
  }, []);

  // --- Chart Rendering ---

  useEffect(() => {
    if (!chartRef.current || !hasChartData) return;

    let cancelled = false;

    import("lightweight-charts").then((lc) => {
      if (cancelled || !chartRef.current) return;

      const { createChart, ColorType, CrosshairMode, LineStyle } = lc;

      // Clean up previous chart
      if (chartInstanceRef.current) {
        (chartInstanceRef.current as { remove: () => void }).remove();
        chartInstanceRef.current = null;
      }

      const chart = createChart(chartRef.current, {
        width: chartRef.current.clientWidth,
        height: 280,
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#555",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10,
        },
        grid: {
          vertLines: { color: "rgba(255,255,255,0.03)" },
          horzLines: { color: "rgba(255,255,255,0.03)" },
        },
        rightPriceScale: {
          borderColor: "rgba(255,255,255,0.08)",
        },
        timeScale: {
          borderColor: "rgba(255,255,255,0.08)",
          timeVisible: false,
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          horzLine: {
            color: "rgba(255,255,255,0.3)",
            style: LineStyle.Dashed,
            labelBackgroundColor: "#333",
          },
          vertLine: {
            color: "rgba(255,255,255,0.3)",
            style: LineStyle.Dashed,
            labelBackgroundColor: "#333",
          },
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let mainSeries: any;

      if (chartType === "candlestick") {
        mainSeries = chart.addCandlestickSeries({
          upColor: "#00ff88",
          downColor: "#ff4444",
          borderUpColor: "#00ff88",
          borderDownColor: "#ff4444",
          wickUpColor: "rgba(0,255,136,0.6)",
          wickDownColor: "rgba(255,68,68,0.6)",
        });
        mainSeries.setData(
          activeCandles.map((d) => ({
            time: d.time as unknown as import("lightweight-charts").Time,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
          }))
        );
      } else if (chartType === "bar") {
        mainSeries = chart.addBarSeries({
          upColor: "#00ff88",
          downColor: "#ff4444",
        });
        mainSeries.setData(
          activeCandles.map((d) => ({
            time: d.time as unknown as import("lightweight-charts").Time,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
          }))
        );
      } else {
        mainSeries = chart.addLineSeries({
          color: "#00ff88",
          lineWidth: 2,
        });
        mainSeries.setData(
          sortedDaily.map((d) => ({
            time: d.time as unknown as import("lightweight-charts").Time,
            value: d.value,
          }))
        );
      }

      // EMA overlays
      if (showEma50 && ema50Data.length > 0) {
        const s = chart.addLineSeries({
          color: "#4488ff",
          lineWidth: 1,
          title: "EMA 50",
        });
        s.setData(
          ema50Data.map((d) => ({
            time: d.time as unknown as import("lightweight-charts").Time,
            value: d.value,
          }))
        );
      }
      if (showEma100 && ema100Data.length > 0) {
        const s = chart.addLineSeries({
          color: "#ff8844",
          lineWidth: 1,
          title: "EMA 100",
        });
        s.setData(
          ema100Data.map((d) => ({
            time: d.time as unknown as import("lightweight-charts").Time,
            value: d.value,
          }))
        );
      }
      if (showEma200 && ema200Data.length > 0) {
        const s = chart.addLineSeries({
          color: "#22cc77",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          title: "EMA 200",
        });
        s.setData(
          ema200Data.map((d) => ({
            time: d.time as unknown as import("lightweight-charts").Time,
            value: d.value,
          }))
        );
      }

      // Current price line
      if (price) {
        const lastCandle = activeCandles[activeCandles.length - 1];
        const isUp = lastCandle
          ? price.price >= lastCandle.close
          : true;
        mainSeries.createPriceLine({
          price: price.price,
          color: isUp ? "#00ff88" : "#ff4444",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "Live",
        });
      }

      // Set visible range
      if (timeframe === "ALL") {
        chart.timeScale().fitContent();
      } else {
        const fromStr = getTimeframeFrom(timeframe);
        const lastItem =
          chartType === "line"
            ? sortedDaily[sortedDaily.length - 1]
            : activeCandles[activeCandles.length - 1];
        if (lastItem) {
          chart.timeScale().setVisibleRange({
            from: fromStr as unknown as import("lightweight-charts").Time,
            to: lastItem.time as unknown as import("lightweight-charts").Time,
          });
        }
      }

      // Crosshair tooltip
      chart.subscribeCrosshairMove((param) => {
        if (!param.time || !param.point) {
          setOhlc((prev) => ({ ...prev, visible: false }));
          return;
        }

        const timeStr = param.time as string;
        const data = param.seriesData.get(mainSeries);
        if (!data) {
          setOhlc((prev) => ({ ...prev, visible: false }));
          return;
        }

        let o = 0,
          h = 0,
          l = 0,
          c = 0;
        if ("open" in data) {
          const d = data as { open: number; high: number; low: number; close: number };
          o = d.open;
          h = d.high;
          l = d.low;
          c = d.close;
        } else if ("value" in data) {
          const v = (data as { value: number }).value;
          o = h = l = c = v;
        }

        const idx = candleIndexMap.get(timeStr);
        const prevClose =
          idx !== undefined && idx > 0
            ? activeCandles[idx - 1].close
            : null;

        setOhlc({
          visible: true,
          time: timeStr,
          open: o,
          high: h,
          low: l,
          close: c,
          prevClose,
          ema50: findEma(ema50Map, timeStr),
          ema100: findEma(ema100Map, timeStr),
          ema200: findEma(ema200Map, timeStr),
        });
      });

      // Range stats
      chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
        if (!range) return;
        const from = range.from as string;
        const to = range.to as string;
        const visible = sortedDaily.filter(
          (d) => d.time >= from && d.time <= to
        );
        if (visible.length === 0) {
          setRangeStats(null);
          return;
        }
        const high = Math.max(...visible.map((d) => d.value));
        const low = Math.min(...visible.map((d) => d.value));
        const first = visible[0].value;
        const last = visible[visible.length - 1].value;
        const change = last - first;
        const pctChange = first !== 0 ? (change / first) * 100 : 0;
        setRangeStats({
          high,
          low,
          change: Math.round(change * 100) / 100,
          pctChange: Math.round(pctChange * 10) / 10,
          startDate: from,
          endDate: to,
        });
      });

      chartInstanceRef.current = chart;

      const el = chartRef.current;
      const resizeObserver = new ResizeObserver(() => {
        if (el) chart.applyOptions({ width: el.clientWidth });
      });
      resizeObserver.observe(el);
    });

    return () => {
      cancelled = true;
      if (chartInstanceRef.current) {
        (chartInstanceRef.current as { remove: () => void }).remove();
        chartInstanceRef.current = null;
      }
    };
  }, [
    chartType,
    timeframe,
    activeCandles,
    sortedDaily,
    hasChartData,
    showEma50,
    showEma100,
    showEma200,
    ema50Data,
    ema100Data,
    ema200Data,
    ema50Map,
    ema100Map,
    ema200Map,
    price,
    candleIndexMap,
    findEma,
  ]);

  // --- Derived ---

  const priceChange = price && prevPrice ? price.price - prevPrice : 0;
  const priceChangeStr =
    priceChange > 0
      ? `+${priceChange.toFixed(4)}`
      : priceChange < 0
        ? priceChange.toFixed(4)
        : "0.0000";

  const candleLabel =
    timeframe === "1M" || timeframe === "3M" ? "days" : "weeks";

  // Last candle for default OHLC display
  const lastCandle = activeCandles[activeCandles.length - 1] ?? null;

  return (
    <div className="terminal-panel flex flex-col h-full overflow-y-auto">
      <div className="terminal-panel-header">
        <span className="inline-block w-2 h-2 rounded-full bg-terminal-green pulse-live" />
        <span>Market Data</span>
        {lastUpdate && (
          <span className="ml-auto text-terminal-muted font-normal text-[9px]">
            Updated {lastUpdate}
          </span>
        )}
      </div>

      <div className="p-3 space-y-3 flex-1">
        {/* Live Price */}
        <div className="terminal-panel glow-border p-4">
          <div className="text-[9px] tracking-[0.2em] uppercase text-terminal-muted mb-2">
            Henry Hub Natural Gas — Live
          </div>
          {priceError ? (
            <div className="text-terminal-red text-[11px]">{priceError}</div>
          ) : price ? (
            <div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-white glow-text tabular-nums">
                  ${price.price.toFixed(4)}
                </span>
                <span className="text-[11px] text-terminal-muted">/MMBtu</span>
              </div>
              <div
                className={`text-[11px] mt-1 tabular-nums ${
                  priceChange >= 0 ? "text-white" : "text-terminal-red"
                }`}
              >
                {priceChangeStr} since last poll
              </div>
            </div>
          ) : (
            <div className="text-terminal-muted text-[11px]">
              Fetching price<span className="cursor-blink">_</span>
            </div>
          )}
        </div>

        {/* Chart Section */}
        <div className="terminal-panel">
          <div className="terminal-panel-header">
            <span>Price Chart — Henry Hub</span>
            <span className="ml-auto text-terminal-muted font-normal text-[9px]">
              {hasChartData
                ? `${activeCandles.length.toLocaleString()} ${candleLabel}`
                : historyLoading
                  ? "Loading..."
                  : "No data"}
            </span>
          </div>

          {/* Controls Bar */}
          <div className="px-2 pt-2 flex items-center gap-1 text-[9px] flex-wrap">
            {/* Timeframe */}
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-0.5 rounded-sm transition-colors ${
                  timeframe === tf
                    ? "bg-white/10 text-white"
                    : "text-terminal-muted hover:text-white"
                }`}
              >
                {tf}
              </button>
            ))}

            <div className="w-px h-3 bg-terminal-border mx-1" />

            {/* Chart Type */}
            {CHART_TYPES.map(({ type, label }) => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                className={`px-2 py-0.5 rounded-sm transition-colors ${
                  chartType === type
                    ? "bg-white/10 text-white"
                    : "text-terminal-muted hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}

            <div className="w-px h-3 bg-terminal-border mx-1" />

            {/* EMA Toggles */}
            <button
              onClick={() => setShowEma50(!showEma50)}
              className={`px-1.5 py-0.5 rounded-sm transition-colors ${
                showEma50
                  ? "text-[#4488ff] bg-[#4488ff]/10"
                  : "text-terminal-muted hover:text-white"
              }`}
            >
              E50
            </button>
            <button
              onClick={() => setShowEma100(!showEma100)}
              className={`px-1.5 py-0.5 rounded-sm transition-colors ${
                showEma100
                  ? "text-[#ff8844] bg-[#ff8844]/10"
                  : "text-terminal-muted hover:text-white"
              }`}
            >
              E100
            </button>
            <button
              onClick={() => setShowEma200(!showEma200)}
              className={`px-1.5 py-0.5 rounded-sm transition-colors ${
                showEma200
                  ? "text-[#22cc77] bg-[#22cc77]/10"
                  : "text-terminal-muted hover:text-white"
              }`}
            >
              E200
            </button>

            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={handleFitToTimeframe}
                className="px-1.5 py-0.5 text-terminal-muted hover:text-white rounded-sm transition-colors"
                title="Fit to selected timeframe"
              >
                Fit
              </button>
              <button
                onClick={handleGoToLatest}
                className="px-1.5 py-0.5 text-terminal-muted hover:text-white rounded-sm transition-colors"
                title="Go to latest price"
              >
                Latest
              </button>
            </div>
          </div>

          {/* OHLC Overlay */}
          <div className="px-2 pt-1 text-[9px] font-mono h-4 tabular-nums">
            {ohlc.visible ? (
              <span className="text-terminal-muted">
                <span className="text-white/50">{ohlc.time}</span>
                {" O:"}
                <span className="text-white">{ohlc.open.toFixed(2)}</span>
                {" H:"}
                <span className="text-white">{ohlc.high.toFixed(2)}</span>
                {" L:"}
                <span className="text-white">{ohlc.low.toFixed(2)}</span>
                {" C:"}
                <span
                  className={
                    ohlc.close >= ohlc.open
                      ? "text-[#00ff88]"
                      : "text-[#ff4444]"
                  }
                >
                  {ohlc.close.toFixed(2)}
                </span>
                {ohlc.prevClose !== null && (
                  <span
                    className={
                      ohlc.close >= ohlc.prevClose
                        ? "text-[#00ff88]"
                        : "text-[#ff4444]"
                    }
                  >
                    {" "}
                    {ohlc.close - ohlc.prevClose >= 0 ? "+" : ""}
                    {(ohlc.close - ohlc.prevClose).toFixed(2)}(
                    {(
                      ((ohlc.close - ohlc.prevClose) / ohlc.prevClose) *
                      100
                    ).toFixed(1)}
                    %)
                  </span>
                )}
                {ohlc.ema50 !== null && (
                  <span className="text-[#4488ff]">
                    {" "}
                    E50:{ohlc.ema50.toFixed(2)}
                  </span>
                )}
                {ohlc.ema100 !== null && (
                  <span className="text-[#ff8844]">
                    {" "}
                    E100:{ohlc.ema100.toFixed(2)}
                  </span>
                )}
                {ohlc.ema200 !== null && (
                  <span className="text-[#22cc77]">
                    {" "}
                    E200:{ohlc.ema200.toFixed(2)}
                  </span>
                )}
              </span>
            ) : lastCandle ? (
              <span className="text-terminal-muted">
                <span className="text-white/50">{lastCandle.time}</span>
                {" O:"}
                <span className="text-white/70">
                  {lastCandle.open.toFixed(2)}
                </span>
                {" H:"}
                <span className="text-white/70">
                  {lastCandle.high.toFixed(2)}
                </span>
                {" L:"}
                <span className="text-white/70">
                  {lastCandle.low.toFixed(2)}
                </span>
                {" C:"}
                <span className="text-white/70">
                  {lastCandle.close.toFixed(2)}
                </span>
              </span>
            ) : null}
          </div>

          {/* Chart */}
          <div className="px-2 pb-1">
            {historyLoading ? (
              <div className="h-[280px] flex items-center justify-center text-terminal-muted text-[11px]">
                Loading historical data
                <span className="cursor-blink">_</span>
              </div>
            ) : historyError ? (
              <div className="h-[280px] flex items-center justify-center text-terminal-red text-[11px]">
                {historyError}
              </div>
            ) : hasChartData ? (
              <div ref={chartRef} className="w-full h-[280px]" />
            ) : (
              <div className="h-[280px] flex items-center justify-center text-terminal-muted text-[11px]">
                No historical data available
              </div>
            )}
          </div>

          {/* Range Stats Bar */}
          {rangeStats && (
            <div className="px-2 pb-2 flex items-center gap-3 text-[9px] text-terminal-muted tabular-nums border-t border-terminal-border/30 pt-1 flex-wrap">
              <span>
                H:{" "}
                <span className="text-white">
                  ${rangeStats.high.toFixed(2)}
                </span>
              </span>
              <span>
                L:{" "}
                <span className="text-white">
                  ${rangeStats.low.toFixed(2)}
                </span>
              </span>
              <span>
                Chg:{" "}
                <span
                  className={
                    rangeStats.change >= 0
                      ? "text-[#00ff88]"
                      : "text-[#ff4444]"
                  }
                >
                  {rangeStats.change >= 0 ? "+" : ""}$
                  {rangeStats.change.toFixed(2)} (
                  {rangeStats.pctChange >= 0 ? "+" : ""}
                  {rangeStats.pctChange.toFixed(1)}%)
                </span>
              </span>
              <span className="ml-auto">
                {rangeStats.startDate} — {rangeStats.endDate}
              </span>
            </div>
          )}
        </div>

        {/* Storage Data */}
        <div className="terminal-panel">
          <div className="terminal-panel-header">
            <span>EIA Storage — Lower 48</span>
          </div>
          <div className="p-3">
            {storageError ? (
              <div className="text-terminal-red text-[11px]">
                {storageError}
              </div>
            ) : storage ? (
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] text-terminal-muted uppercase tracking-wider">
                    Current
                  </span>
                  <span className="text-lg font-bold text-terminal-text tabular-nums">
                    {storage.current.value.toLocaleString()}{" "}
                    <span className="text-[10px] text-terminal-muted font-normal">
                      BCF
                    </span>
                  </span>
                </div>
                <div className="text-[9px] text-terminal-muted text-right">
                  Week of {storage.current.period}
                </div>

                <div className="border-t border-terminal-border my-2" />

                {storage.fiveYearAvg && (
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-terminal-muted uppercase tracking-wider">
                      vs 5-Year Avg
                    </span>
                    <span
                      className={`text-[13px] font-semibold tabular-nums ${
                        storage.fiveYearAvg.diff >= 0
                          ? "text-white"
                          : "text-terminal-red"
                      }`}
                    >
                      {storage.fiveYearAvg.diff >= 0 ? "+" : ""}
                      {storage.fiveYearAvg.diff.toLocaleString()} (
                      {storage.fiveYearAvg.pctChange >= 0 ? "+" : ""}
                      {storage.fiveYearAvg.pctChange}%)
                    </span>
                  </div>
                )}

                {storage.yearAgo && (
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-terminal-muted uppercase tracking-wider">
                      vs Year Ago
                    </span>
                    <span
                      className={`text-[13px] font-semibold tabular-nums ${
                        storage.yearAgo.diff >= 0
                          ? "text-white"
                          : "text-terminal-red"
                      }`}
                    >
                      {storage.yearAgo.diff >= 0 ? "+" : ""}
                      {storage.yearAgo.diff.toLocaleString()} (
                      {storage.yearAgo.pctChange >= 0 ? "+" : ""}
                      {storage.yearAgo.pctChange}%)
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-terminal-muted text-[11px]">
                Fetching storage data<span className="cursor-blink">_</span>
              </div>
            )}
          </div>
        </div>

        <div className="text-[9px] text-terminal-muted text-center py-1">
          Live price: 60s interval · Chart: EIA daily history
        </div>
      </div>
    </div>
  );
}
