// POST /api/email-summary/refresh — regenerate the briefing now instead of
// waiting for the morning cron.
import {
  assertOrigin,
  errorResponse,
  json,
  rateLimit,
} from "@/lib/server/http";
import { generateOwnSummary } from "@/lib/server/email-summary/service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    assertOrigin(request);
    await rateLimit("email-summary:refresh", 60, 60_000);
    return json(await generateOwnSummary());
  } catch (error) {
    return errorResponse(error);
  }
}
