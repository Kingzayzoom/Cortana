// GET /api/auth/google/callback — finishes Google sign-in, links the account
// to a profile (carrying anonymous progress over on first sign-in) and swaps
// the session cookie. Failures redirect home with a short error code.
import {
  accountId,
  completeGoogleAuth,
  consumeOAuthCookie,
} from "@/lib/server/auth";
import { appOrigin } from "@/lib/server/http";
import { RequestError } from "@/lib/server/errors";
import { profileSession, setProfileSession } from "@/lib/server/session";
import { linkAccount } from "@/lib/server/store";
export const runtime = "nodejs";

// Status → the code the page turns into a sentence (see AccountControls).
const CODES: Record<number, string> = {
  401: "expired",
  403: "denied",
  500: "config",
  503: "config",
  504: "provider",
};

export async function GET(request: Request) {
  const origin = appOrigin(request);
  const back = (result: string) =>
    Response.redirect(`${origin}/?auth_error=${result}`, 302);
  const params = new URL(request.url).searchParams;
  try {
    // The user declined, or Google refused the request.
    if (params.get("error")) return back("denied");
    const code = params.get("code"),
      state = params.get("state");
    if (!code || !state) return back("state");
    const verifier = await consumeOAuthCookie(state);
    if (!verifier) return back("state");

    const account = await completeGoogleAuth(request, code, verifier);
    const anonymous = await profileSession();
    const id = accountId(account.subject);
    await linkAccount(anonymous, id, account);
    await setProfileSession(id);
    return Response.redirect(`${origin}/?signed_in=1`, 302);
  } catch (error) {
    if (error instanceof RequestError)
      return back(CODES[error.status] ?? "provider");
    return back("server");
  }
}
