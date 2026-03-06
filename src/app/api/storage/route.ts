import { NextRequest } from "next/server";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { rateLimitResponse, errorResponse, jsonResponse } from "@/lib/validate";

interface EiaDataPoint {
  period: string;
  value: number;
}

function weekOfYear(dateStr: string): number {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "storage", RATE_LIMITS.STANDARD);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  const eiaKey = process.env.EIA_API_KEY;
  if (!eiaKey) return errorResponse("Server misconfigured: missing EIA API key", 500);

  try {
    const url = new URL("https://api.eia.gov/v2/seriesid/NG.NW2_EPG0_SWO_R48_BCF.W");
    url.searchParams.set("api_key", eiaKey);
    url.searchParams.set("sort[0][column]", "period");
    url.searchParams.set("sort[0][direction]", "desc");
    url.searchParams.set("length", "300");

    const res = await fetch(url.toString(), { next: { revalidate: 0 } });

    if (!res.ok) {
      const text = await res.text();
      return errorResponse(`EIA API error: ${res.status} — ${text}`, res.status);
    }

    const json = await res.json();
    const rows: EiaDataPoint[] = (json?.response?.data || [])
      .filter(
        (d: Record<string, unknown>) =>
          d.period && typeof d.value === "number"
      )
      .map((d: Record<string, unknown>) => ({
        period: String(d.period),
        value: Number(d.value),
      }));

    if (rows.length === 0) {
      return errorResponse("No storage data returned from EIA");
    }

    const current = rows[0];
    const currentWeek = weekOfYear(current.period);
    const currentYear = new Date(current.period).getFullYear();

    const yearAgoTarget = `${currentYear - 1}`;
    const yearAgoRow = rows.find((r) => {
      const rWeek = weekOfYear(r.period);
      return r.period.startsWith(yearAgoTarget) && Math.abs(rWeek - currentWeek) <= 2;
    });

    const fiveYearValues: number[] = [];
    for (let y = 1; y <= 5; y++) {
      const targetYear = `${currentYear - y}`;
      const match = rows.find((r) => {
        const rWeek = weekOfYear(r.period);
        return r.period.startsWith(targetYear) && Math.abs(rWeek - currentWeek) <= 2;
      });
      if (match) fiveYearValues.push(match.value);
    }

    const fiveYearAvg =
      fiveYearValues.length > 0
        ? Math.round(fiveYearValues.reduce((a, b) => a + b, 0) / fiveYearValues.length)
        : null;

    const yearAgoValue = yearAgoRow?.value ?? null;

    return jsonResponse({
      current: { period: current.period, value: current.value, unit: "BCF" },
      yearAgo: yearAgoValue
        ? {
            value: yearAgoValue,
            diff: current.value - yearAgoValue,
            pctChange: Math.round(((current.value - yearAgoValue) / yearAgoValue) * 1000) / 10,
          }
        : null,
      fiveYearAvg: fiveYearAvg
        ? {
            value: fiveYearAvg,
            diff: current.value - fiveYearAvg,
            pctChange: Math.round(((current.value - fiveYearAvg) / fiveYearAvg) * 1000) / 10,
          }
        : null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return errorResponse(
      `Failed to fetch storage data: ${err instanceof Error ? err.message : "Unknown error"}`,
      502
    );
  }
}
