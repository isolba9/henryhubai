import { NextRequest } from "next/server";
import { getSessionCookie, deleteSession, clearSessionCookieHeader } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = getSessionCookie(request);
  if (token) {
    await deleteSession(token);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearSessionCookieHeader(),
    },
  });
}
