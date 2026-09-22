// DELETE /api/email-summary/disconnect — revokes the Gmail grant and deletes
// the stored tokens and briefing.
import { assertOrigin, errorResponse, json } from "@/lib/server/http";
import { disconnectGmail } from "@/lib/server/email-summary/auth";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
    assertOrigin(request);
    await disconnectGmail();
    return json({ connected: false });
  } catch (error) {
    return errorResponse(error);
  }
}
