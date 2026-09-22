import { disconnectGmail } from "@/lib/server/email-summary/auth";
import { assertOrigin, safeError } from "@/lib/server/session";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
    assertOrigin(request);
    await disconnectGmail();
    return Response.json(
      { connected: false },
      {
        headers: { "Cache-Control": "no-store, private" },
      },
    );
  } catch (error) {
    const response = safeError(error);
    response.headers.set("Cache-Control", "no-store, private");
    return response;
  }
}
