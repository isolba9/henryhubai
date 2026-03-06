import { NextRequest } from "next/server";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { rateLimitResponse, errorResponse } from "@/lib/validate";
import {
  hashPassword,
  createUser,
  createSession,
  sessionCookieHeader,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "auth-signup", RATE_LIMITS.AUTH);
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
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return errorResponse("Valid email is required");
  }
  if (password.length < 6) {
    return errorResponse("Password must be at least 6 characters");
  }

  const passwordHash = hashPassword(password);
  const result = await createUser(email, passwordHash, displayName || undefined);

  if (result.error) {
    return errorResponse(result.error, result.error.includes("already") ? 409 : 500);
  }

  const user = result.user!;
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
      status: 201,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": sessionCookieHeader(token),
      },
    }
  );
}
