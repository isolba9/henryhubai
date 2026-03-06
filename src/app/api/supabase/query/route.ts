import { NextRequest } from "next/server";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import {
  validateIsoDate,
  rateLimitResponse,
  errorResponse,
  jsonResponse,
} from "@/lib/validate";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "supabase-query", RATE_LIMITS.STANDARD);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return errorResponse("Server misconfigured: missing Supabase credentials", 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const startDate = validateIsoDate(body.startDate);
  const endDate = validateIsoDate(body.endDate);

  let queryUrl = `${supabaseUrl}/rest/v1/price_history?order=timestamp.desc`;
  if (startDate) queryUrl += `&timestamp=gte.${startDate}`;
  if (endDate) queryUrl += `&timestamp=lte.${endDate}`;

  const limit = Math.min(Math.max(Number(body.limit) || 1000, 1), 10000);
  queryUrl += `&limit=${limit}`;

  try {
    const res = await fetch(queryUrl, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return errorResponse(`Database query error: ${res.status} — ${text}`, res.status);
    }

    const data = await res.json();
    return jsonResponse({ data, count: data.length });
  } catch (err) {
    return errorResponse(
      `Database query failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      502
    );
  }
}
