import { NextRequest } from "next/server";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import {
  validateApiKey,
  validateUrl,
  sanitizeString,
  rateLimitResponse,
  errorResponse,
  jsonResponse,
} from "@/lib/validate";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "supabase-write", RATE_LIMITS.STANDARD);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const supabaseUrl =
    validateUrl(body.supabaseUrl as string) ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  const supabaseKey =
    validateApiKey(body.supabaseKey) ||
    sanitizeString(process.env.SUPABASE_ANON_KEY || "");

  if (!supabaseUrl || !supabaseKey) {
    return errorResponse("Supabase credentials are required", 401);
  }

  const priceData = body.priceData as Record<string, unknown> | undefined;
  if (!priceData || typeof priceData.price !== "number") {
    return errorResponse("Valid price data is required");
  }

  const record = {
    timestamp: new Date().toISOString(),
    price: Number(priceData.price),
    name: sanitizeString(String(priceData.name || ""), 100),
    exchange: sanitizeString(String(priceData.exchange || ""), 100),
    updated: typeof priceData.updated === "number" ? priceData.updated : null,
  };

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/price_history`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(record),
    });

    if (!res.ok) {
      const text = await res.text();
      return errorResponse(
        `Supabase write error: ${res.status} — ${text}`,
        res.status
      );
    }

    return jsonResponse({ success: true, record });
  } catch (err) {
    return errorResponse(
      `Supabase write failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      502
    );
  }
}
