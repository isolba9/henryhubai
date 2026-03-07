import { NextRequest } from "next/server";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import {
  sanitizeString,
  rateLimitResponse,
  jsonResponse,
} from "@/lib/validate";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "analytics", RATE_LIMITS.STANDARD);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return jsonResponse({ ok: true });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: true });
  }

  const eventName = sanitizeString(body.event, 100);
  if (!eventName) return jsonResponse({ ok: true });

  const record = {
    event_name: eventName,
    properties:
      body.properties && typeof body.properties === "object"
        ? body.properties
        : {},
    session_id: sanitizeString(body.sessionId, 100) || null,
    user_id: sanitizeString(body.userId, 100) || null,
    page_path: sanitizeString(body.pagePath, 500) || "/",
    referrer: sanitizeString(body.referrer, 1000) || null,
    user_agent: sanitizeString(
      request.headers.get("user-agent") || "",
      500
    ) || null,
  };

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/analytics_events`, {
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
      console.error(`Analytics write failed: ${res.status}`);
    }
  } catch (err) {
    console.error("Analytics error:", err);
  }

  return jsonResponse({ ok: true });
}
