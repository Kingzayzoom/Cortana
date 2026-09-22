// GET /api/email-summary/connect — starts the Gmail read-only OAuth flow.
import { beginGmailOAuth } from "@/lib/server/email-summary/auth";
import { appOrigin, rateLimit } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await rateLimit("email-summary:oauth", 60, 60_000);
    return Response.redirect(await beginGmailOAuth(), 302);
  } catch {
    // Missing configuration; the page explains what to set.
    return Response.redirect(
      `${appOrigin(request)}/email-summary?email_error=config`,
      302,
    );
  }
}
