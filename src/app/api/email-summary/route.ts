// GET /api/email-summary — whether Gmail is connected, and the latest briefing.
import { errorResponse, json } from "@/lib/server/http";
import { emailSummaryStatus } from "@/lib/server/email-summary/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    return json(await emailSummaryStatus());
  } catch (error) {
    return errorResponse(error);
  }
}
