import { NextRequest } from "next/server";
import { authenticateRequest, listConversations } from "@/lib/auth";
import { errorResponse, jsonResponse } from "@/lib/validate";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error || !auth.user) {
    return errorResponse(auth.error || "Not authenticated", 401);
  }

  const conversations = await listConversations(auth.user.id);
  return jsonResponse({ conversations });
}
