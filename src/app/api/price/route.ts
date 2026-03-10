import { NextRequest } from "next/server";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { rateLimitResponse, errorResponse, jsonResponse } from "@/lib/validate";

/* ── In-memory cache (survives across requests within the same serverless cold start) ── */
let cachedPrice: {
  price: number;
  date: string;
  fetchedAt: number;
} | null = null;

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "price", RATE_LIMITS.STANDARD);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  // Return cached price if fresh
  if (cachedPrice && Date.now() - cachedPrice.fetchedAt < CACHE_TTL_MS) {
    return jsonResponse({
      name: "Natural Gas",
      price: cachedPrice.price,
      currency: "USD",
      exchange: "Henry Hub",
      date: cachedPrice.date,
      updated: Math.floor(cachedPrice.fetchedAt / 1000),
      timestamp: new Date().toISOString(),
    });
  }

  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) return errorResponse("Server misconfigured: missing EIA API key", 500);

  try {
    // EIA API v2 — Henry Hub Natural Gas Spot Price (daily)
    const url = new URL("https://api.eia.gov/v2/natural-gas/pri/spot/data");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("frequency", "daily");
    url.searchParams.set("data[0]", "value");
    url.searchParams.set("facets[series][]", "RNGWHHD");
    url.searchParams.set("sort[0][column]", "period");
    url.searchParams.set("sort[0][direction]", "desc");
    url.searchParams.set("length", "1");

    const res = await fetch(url.toString(), { next: { revalidate: 0 } });

    if (!res.ok) {
      const text = await res.text();
      return errorResponse(`EIA API error: ${res.status} — ${text}`, res.status);
    }

    const json = await res.json();
    const record = json?.response?.data?.[0];

    if (!record || typeof record.value !== "number") {
      return errorResponse("No price data available from EIA");
    }

    // Cache the result
    cachedPrice = {
      price: record.value,
      date: record.period,
      fetchedAt: Date.now(),
    };

    return jsonResponse({
      name: "Natural Gas",
      price: record.value,
      currency: "USD",
      exchange: "Henry Hub",
      date: record.period,
      updated: Math.floor(Date.now() / 1000),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    // If fetch fails but we have stale cache, return it
    if (cachedPrice) {
      return jsonResponse({
        name: "Natural Gas",
        price: cachedPrice.price,
        currency: "USD",
        exchange: "Henry Hub",
        date: cachedPrice.date,
        updated: Math.floor(cachedPrice.fetchedAt / 1000),
        timestamp: new Date().toISOString(),
      });
    }
    return errorResponse(
      `Failed to fetch price: ${err instanceof Error ? err.message : "Unknown error"}`,
      502
    );
  }
}
