// POST /api/auth/signout — drops the session cookie. The next bootstrap issues
// a fresh anonymous profile; the account's saved record is untouched.
import { assertOrigin, errorResponse, json } from "@/lib/server/http";
import { clearProfileSession } from "@/lib/server/session";
export const runtime = "nodejs";

// POST-only and origin-checked: signing someone out is a state change.
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    await clearProfileSession();
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
