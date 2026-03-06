"use client";

import { useState, useEffect, useRef, useCallback } from "react";

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

interface ChartPoint {
  timestamp: string;
  price: number;
}

export default function PricePanel() {
  const [price, setPrice] = useState<PriceData | null>(null);
  const [prevPrice, setPrevPrice] = useState<number | null>(null);
  const [storage, setStorage] = useState<StorageData | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [priceError, setPriceError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<unknown>(null);

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

      setPrevPrice((prev) => prev);
      setPrice((prev) => {
        if (prev) setPrevPrice(prev.price);
        return data;
      });
      setPriceError("");
      setLastUpdate(new Date().toLocaleTimeString());

      // Write to Supabase
      fetch("/api/supabase/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceData: data }),
      }).catch(() => {});

      // Add to local chart data
      setChartData((prev) => [
        ...prev.slice(-500),
        { timestamp: data.timestamp, price: data.price },
      ]);
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

  // Fetch chart data from Supabase
  const fetchChartData = useCallback(async () => {
    try {
      const res = await fetch("/api/supabase/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 500 }),
      });
      const data = await res.json();
      if (!res.ok) return;
      if (data.data && data.data.length > 0) {
        setChartData(
          data.data
            .reverse()
            .map((d: Record<string, unknown>) => ({
              timestamp: String(d.timestamp),
              price: Number(d.price),
            }))
        );
      }
    } catch {
      // silently fail for chart data
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchPrice();
    fetchStorage();
    fetchChartData();
  }, [fetchPrice, fetchStorage, fetchChartData]);

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
        height: 200,
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#666",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10,
        },
        grid: {
          vertLines: { color: "rgba(0,255,136,0.04)" },
          horzLines: { color: "rgba(0,255,136,0.04)" },
        },
        rightPriceScale: { borderColor: "rgba(0,255,136,0.1)" },
        timeScale: { borderColor: "rgba(0,255,136,0.1)", timeVisible: true },
        crosshair: {
          horzLine: { color: "rgba(0,255,136,0.3)" },
          vertLine: { color: "rgba(0,255,136,0.3)" },
        },
      });

      const series = chart.addAreaSeries({
        lineColor: "#00ff88",
        topColor: "rgba(0,255,136,0.15)",
        bottomColor: "rgba(0,255,136,0.01)",
        lineWidth: 2,
      });

      const seriesData = chartData.map((d) => ({
        time: (new Date(d.timestamp).getTime() / 1000) as unknown as import("lightweight-charts").Time,
        value: d.price,
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
            <span>Price Chart</span>
            <span className="ml-auto text-terminal-muted font-normal text-[9px]">
              {chartData.length > 0
                ? `${chartData.length} data points`
                : "No data"}
            </span>
          </div>
          <div className="p-2">
            {chartData.length > 0 ? (
              <div ref={chartRef} className="w-full" />
            ) : (
              <div className="h-[200px] flex items-center justify-center text-terminal-muted text-[11px] grid-bg">
                Collecting data — chart will populate as prices are polled
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
          Auto-refresh: 60s interval
        </div>
      </div>
    </div>
  );
}
