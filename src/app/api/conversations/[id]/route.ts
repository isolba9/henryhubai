import { NextRequest } from "next/server";
import { authenticateRequest, deleteConversation } from "@/lib/auth";
import { errorResponse, jsonResponse } from "@/lib/validate";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (auth.error || !auth.user) {
    return errorResponse(auth.error || "Not authenticated", 401);
  }

  const { id } = await params;
  const ok = await deleteConversation(id, auth.user.id);
  if (!ok) return errorResponse("Failed to delete conversation", 500);
  return jsonResponse({ ok: true });
}
