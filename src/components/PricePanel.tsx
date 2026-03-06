"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

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

interface HistoryPoint {
  time: string;
  value: number;
}

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
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<unknown>(null);

  // Fetch full historical data from EIA
  const fetchHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const res = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.data && data.data.length > 0) {
        setHistoryData(data.data);
      }
      setHistoryError("");
    } catch (err) {
      setHistoryError(
        err instanceof Error ? err.message : "History fetch failed"
      );
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Fetch live price
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

      // Write to Supabase (for download/analysis features)
      fetch("/api/supabase/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceData: data }),
      }).catch(() => {});
    } catch (err) {
      setPriceError(err instanceof Error ? err.message : "Price fetch failed");
    }
  }, []);

  // Fetch storage data
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

  // Combined chart data: EIA history + today's live price
  const chartData = useMemo(() => {
    if (historyData.length === 0) return [];
    const combined = [...historyData];
    if (price) {
      const today = new Date().toISOString().split("T")[0];
      const lastIdx = combined.length - 1;
      if (combined[lastIdx]?.time === today) {
        combined[lastIdx] = { time: today, value: price.price };
      } else {
        combined.push({ time: today, value: price.price });
      }
    }
    return combined;
  }, [historyData, price]);

  // Initial load
  useEffect(() => {
    fetchHistory();
    fetchPrice();
    fetchStorage();
  }, [fetchHistory, fetchPrice, fetchStorage]);

  // 60-second price polling
  useEffect(() => {
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, [fetchPrice]);

  // Render chart with lightweight-charts
  useEffect(() => {
    if (!chartRef.current || chartData.length === 0) return;

    let cancelled = false;

    import("lightweight-charts").then(({ createChart, ColorType }) => {
      if (cancelled || !chartRef.current) return;

      if (chartInstanceRef.current) {
        (chartInstanceRef.current as { remove: () => void }).remove();
        chartInstanceRef.current = null;
      }

      const chart = createChart(chartRef.current, {
        width: chartRef.current.clientWidth,
        height: 260,
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#666",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10,
        },
        grid: {
          vertLines: { color: "rgba(255,255,255,0.03)" },
          horzLines: { color: "rgba(255,255,255,0.03)" },
        },
        rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
        timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: false },
        crosshair: {
          horzLine: { color: "rgba(255,255,255,0.2)" },
          vertLine: { color: "rgba(255,255,255,0.2)" },
        },
      });

      const series = chart.addAreaSeries({
        lineColor: "#00ff88",
        topColor: "rgba(0,255,136,0.12)",
        bottomColor: "rgba(0,255,136,0.01)",
        lineWidth: 2,
      });

      const seriesData = chartData.map((d) => ({
        time: d.time as unknown as import("lightweight-charts").Time,
        value: d.value,
      }));

      series.setData(seriesData);
      chart.timeScale().fitContent();
      chartInstanceRef.current = chart;

      const resizeObserver = new ResizeObserver(() => {
        if (chartRef.current) {
          chart.applyOptions({ width: chartRef.current.clientWidth });
        }
      });
      resizeObserver.observe(chartRef.current);
    });

    return () => {
      cancelled = true;
    };
  }, [chartData]);

  const priceChange = price && prevPrice ? price.price - prevPrice : 0;
  const priceChangeStr =
    priceChange > 0
      ? `+${priceChange.toFixed(4)}`
      : priceChange < 0
        ? priceChange.toFixed(4)
        : "0.0000";

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

        {/* Chart */}
        <div className="terminal-panel">
          <div className="terminal-panel-header">
            <span>Price Chart — Henry Hub Historical</span>
            <span className="ml-auto text-terminal-muted font-normal text-[9px]">
              {chartData.length > 0
                ? `${chartData.length.toLocaleString()} days`
                : historyLoading
                  ? "Loading..."
                  : "No data"}
            </span>
          </div>
          <div className="p-2">
            {historyLoading ? (
              <div className="h-[260px] flex items-center justify-center text-terminal-muted text-[11px]">
                Loading historical data<span className="cursor-blink">_</span>
              </div>
            ) : historyError ? (
              <div className="h-[260px] flex items-center justify-center text-terminal-red text-[11px]">
                {historyError}
              </div>
            ) : chartData.length > 0 ? (
              <div ref={chartRef} className="w-full" />
            ) : (
              <div className="h-[260px] flex items-center justify-center text-terminal-muted text-[11px]">
                No historical data available
              </div>
            )}
          </div>
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
