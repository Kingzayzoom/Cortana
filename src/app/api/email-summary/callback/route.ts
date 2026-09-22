import {
  completeGmailOAuth,
  GmailOAuthError,
} from "@/lib/server/email-summary/auth";
import { config } from "@/lib/server/email-summary/config";
import { RequestError } from "@/lib/server/errors";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const destination = new URL("/email-summary", config().redirectUri);
  const params = new URL(request.url).searchParams;
  if (params.get("error")) {
    destination.searchParams.set("email_error", "denied");
    return Response.redirect(destination, 302);
  }
  const code = params.get("code"),
    state = params.get("state");
  if (!code || !state) {
    destination.searchParams.set("email_error", "expired");
    return Response.redirect(destination, 302);
  }
  try {
    await completeGmailOAuth(code, state);
    destination.searchParams.set("email_connected", "1");
  } catch (error) {
    destination.searchParams.set(
      "email_error",
      error instanceof GmailOAuthError
        ? error.code
        : error instanceof RequestError && error.status === 401
          ? "expired"
          : "failed",
    );
  }
  return Response.redirect(destination, 302);
}
