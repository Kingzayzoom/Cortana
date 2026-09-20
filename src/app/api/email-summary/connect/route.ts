import { beginGmailOAuth } from "@/lib/server/email-summary/auth";
import { appOrigin, rateLimit } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await rateLimit("email-summary:oauth", 60, 60_000);
    if (new URL(request.url).searchParams.has("mode"))
      return Response.redirect(`${appOrigin(request)}/email-summary?email_error=config`, 302);
    return Response.redirect(await beginGmailOAuth(), 302);
  } catch {
    return Response.redirect(`${appOrigin(request)}/email-summary?email_error=config`, 302);
  }
}
