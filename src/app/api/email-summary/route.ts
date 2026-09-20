import { emailSummaryStatus } from "@/lib/server/email-summary";
import { safeError } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json(await emailSummaryStatus(), {
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch (error) {
    const response = safeError(error);
    response.headers.set("Cache-Control", "no-store, private");
    return response;
  }
}
