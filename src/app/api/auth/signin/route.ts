import { NextRequest } from "next/server";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { rateLimitResponse, errorResponse } from "@/lib/validate";
import {
  findUserByEmail,
  verifyPassword,
  createSession,
  sessionCookieHeader,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "auth-signin", RATE_LIMITS.AUTH);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return errorResponse("Server misconfigured", 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return errorResponse("Email and password are required");
  }

  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return errorResponse("Invalid email or password", 401);
  }

  const token = await createSession(user.id);
  if (!token) {
    return errorResponse("Failed to create session", 500);
  }

  return new Response(
    JSON.stringify({
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
      },
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": sessionCookieHeader(token),
      },
    }
  );
}
