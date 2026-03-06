import { NextRequest } from "next/server";
import { authenticateRequest, getMessages } from "@/lib/auth";
import { errorResponse, jsonResponse } from "@/lib/validate";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (auth.error || !auth.user) {
    return errorResponse(auth.error || "Not authenticated", 401);
  }

  const { id } = await params;
  const messages = await getMessages(id);
  return jsonResponse({ messages });
}
