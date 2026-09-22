import {
  assertOrigin,
  clearProfileSession,
  safeError,
} from "@/lib/server/session";
export const runtime = "nodejs";

/** POST-only and origin-checked: signing someone out is a state change. */
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    await clearProfileSession();
    // The next bootstrap issues a fresh anonymous profile.
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return safeError(error);
  }
}
