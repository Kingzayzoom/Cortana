// GET /api/auth/google — starts Google sign-in with PKCE. A top-level
// navigation, so there is no Origin header to assert; the OAuth state cookie
// protects the round trip instead.
import { beginGoogleAuth } from "@/lib/server/auth";
import { appOrigin, rateLimit } from "@/lib/server/http";
import { profileSession } from "@/lib/server/session";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    // Keep (or create) the anonymous profile so the callback can carry its progress over.
    const id = await profileSession(true);
    await rateLimit(`signin:${id}`, 10, 600_000);
    return Response.redirect(await beginGoogleAuth(request), 302);
  } catch {
    return Response.redirect(`${appOrigin(request)}/?auth_error=config`, 302);
  }
}
