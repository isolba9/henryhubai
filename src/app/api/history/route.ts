import { NextRequest } from "next/server";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { rateLimitResponse, errorResponse, jsonResponse } from "@/lib/validate";

// In-memory cache: historical data changes once per day at most
let cache: { data: { time: string; value: number }[]; fetchedAt: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "history", RATE_LIMITS.STANDARD);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  const eiaKey = process.env.EIA_API_KEY;
  if (!eiaKey) return errorResponse("Server misconfigured: missing EIA API key", 500);

  // Return cached data if fresh
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return jsonResponse({ data: cache.data, total: cache.data.length, cached: true });
  }

  try {
    const allData: { time: string; value: number }[] = [];
    let offset = 0;
    const pageSize = 5000;
    let hasMore = true;

    while (hasMore) {
      const url = new URL("https://api.eia.gov/v2/natural-gas/pri/fut/data/");
      url.searchParams.set("api_key", eiaKey);
      url.searchParams.set("data[]", "value");
      url.searchParams.set("facets[series][]", "RNGWHHD");
      url.searchParams.set("frequency", "daily");
      url.searchParams.set("sort[0][column]", "period");
      url.searchParams.set("sort[0][direction]", "asc");
      url.searchParams.set("length", String(pageSize));
      url.searchParams.set("offset", String(offset));

      const res = await fetch(url.toString());

      if (!res.ok) {
        const text = await res.text();
        return errorResponse(`EIA API error: ${res.status} — ${text}`, res.status);
      }

      const json = await res.json();
      const rows = json?.response?.data || [];

      for (const row of rows) {
        if (row.period && typeof row.value === "number") {
          allData.push({ time: String(row.period), value: Number(row.value) });
        }
      }

      offset += pageSize;
      hasMore = rows.length === pageSize;
    }

    if (allData.length === 0) {
      return errorResponse("No historical price data returned from EIA");
    }

    // Update cache
    cache = { data: allData, fetchedAt: Date.now() };

    return jsonResponse({ data: allData, total: allData.length, cached: false });
  } catch (err) {
    // Return stale cache if available
    if (cache) {
      return jsonResponse({ data: cache.data, total: cache.data.length, cached: true, stale: true });
    }
    return errorResponse(
      `Failed to fetch history: ${err instanceof Error ? err.message : "Unknown error"}`,
      502
    );
  }
}
