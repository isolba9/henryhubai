import { NextRequest } from "next/server";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { rateLimitResponse, errorResponse, jsonResponse } from "@/lib/validate";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "price", RATE_LIMITS.STANDARD);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  const apiKey = process.env.API_NINJAS_KEY;
  if (!apiKey) return errorResponse("Server misconfigured: missing API Ninjas key", 500);

  try {
    const res = await fetch(
      "https://api.api-ninjas.com/v1/commodityprice?name=natural_gas",
      {
        headers: { "X-Api-Key": apiKey },
        next: { revalidate: 0 },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return errorResponse(`API Ninjas error: ${res.status} — ${text}`, res.status);
    }

    const data = await res.json();
    const record = Array.isArray(data) ? data[0] : data;
    if (!record || typeof record.price !== "number") {
      return errorResponse("Unexpected response from API Ninjas");
    }

    return jsonResponse({
      name: record.name || "Natural Gas",
      price: record.price,
      currency: record.currency || "USD",
      exchange: record.exchange || "",
      updated: record.updated || Math.floor(Date.now() / 1000),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return errorResponse(
      `Failed to fetch price: ${err instanceof Error ? err.message : "Unknown error"}`,
      502
    );
  }
}
