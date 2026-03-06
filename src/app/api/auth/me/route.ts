import { NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { errorResponse } from "@/lib/validate";

export async function GET(request: NextRequest) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return errorResponse("Server misconfigured", 500);
  }

  const auth = await authenticateRequest(request);
  if (auth.error || !auth.user) {
    return errorResponse(auth.error || "Not authenticated", 401);
  }

  return new Response(
    JSON.stringify({
      user: {
        id: auth.user.id,
        email: auth.user.email,
        display_name: auth.user.display_name,
      },
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
