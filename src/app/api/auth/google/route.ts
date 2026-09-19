import { beginGoogleAuth } from "@/lib/server/auth";
import { appOrigin, profileSession, rateLimit } from "@/lib/server/session";
export const runtime = "nodejs";

/** Starts Google sign-in. A top-level navigation, so there is no Origin to assert. */
export async function GET(request: Request) {
  try {
    // Keep (or create) the anonymous profile so the callback can carry its progress over.
    const id = await profileSession(true);
    rateLimit(`signin:${id}`, 10, 600_000);
    return Response.redirect(await beginGoogleAuth(request), 302);
  } catch {
    return Response.redirect(`${appOrigin(request)}/?auth_error=config`, 302);
  }
}
