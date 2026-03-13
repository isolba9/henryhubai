import { NextRequest } from "next/server";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { rateLimitResponse, errorResponse, jsonResponse } from "@/lib/validate";

const VALID_DAYS = new Set([7, 30, 90]);
const VALID_SUBS = new Set(["all", "naturalgas", "energy", "commodities", "natgas", "oil"]);

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "sentiment", RATE_LIMITS.STANDARD);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return errorResponse("Server misconfigured", 500);
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "30", 10);
  const subreddit = (searchParams.get("subreddit") || "all").toLowerCase();

  if (!VALID_DAYS.has(days)) return errorResponse("Invalid days parameter");
  if (!VALID_SUBS.has(subreddit)) return errorResponse("Invalid subreddit");

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/sentiment_summary`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_days: days, p_subreddit: subreddit }),
  });

  if (!res.ok) {
    return errorResponse(`Database error: ${res.status}`, 500);
  }

  const data = await res.json();
  return jsonResponse(data);
}
