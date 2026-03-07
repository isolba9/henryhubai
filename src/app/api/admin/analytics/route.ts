import { NextRequest } from "next/server";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { authenticateAdmin } from "@/lib/auth";
import { rateLimitResponse, errorResponse, jsonResponse } from "@/lib/validate";

async function rpc(
  url: string,
  headers: Record<string, string>,
  fn: string
) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers,
    body: "{}",
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchRecentEvents(
  url: string,
  headers: Record<string, string>
) {
  const res = await fetch(
    `${url}/rest/v1/analytics_events?select=id,event_name,properties,session_id,user_id,page_path,referrer,created_at&order=created_at.desc&limit=50`,
    { headers }
  );
  if (!res.ok) return [];
  return res.json();
}

async function fetchTotalUsers(
  url: string,
  headers: Record<string, string>
) {
  const res = await fetch(
    `${url}/rest/v1/users?select=id&role=neq.admin`,
    { headers: { ...headers, Prefer: "count=exact" } }
  );
  const count = res.headers.get("content-range")?.split("/")[1] || "0";
  return parseInt(count, 10);
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "admin-analytics", RATE_LIMITS.STANDARD);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  const auth = await authenticateAdmin(request);
  if (auth.error || !auth.user) {
    const status = auth.error === "Forbidden" ? 403 : 401;
    return errorResponse(auth.error || "Forbidden", status);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return errorResponse("Server misconfigured", 500);
  }

  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
  };

  const [overview, featureUsage, referrers, userActivity, recentEvents, totalUsers] =
    await Promise.all([
      rpc(supabaseUrl, headers, "admin_overview_stats"),
      rpc(supabaseUrl, headers, "admin_feature_usage"),
      rpc(supabaseUrl, headers, "admin_referrer_sources"),
      rpc(supabaseUrl, headers, "admin_user_activity"),
      fetchRecentEvents(supabaseUrl, headers),
      fetchTotalUsers(supabaseUrl, headers),
    ]);

  return jsonResponse({
    overview,
    featureUsage,
    referrers,
    userActivity,
    recentEvents,
    totalUsers,
  });
}
