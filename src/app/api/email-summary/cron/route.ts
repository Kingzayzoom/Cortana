// GET /api/email-summary/cron — Vercel Cron (vercel.json, 13:00 UTC) builds each
// connected inbox's morning briefing. Vercel sends CRON_SECRET as a Bearer token.
import { errorResponse, json } from "@/lib/server/http";
import { safeEqual } from "@/lib/server/session";
import { generateDailySummaries } from "@/lib/server/email-summary/service";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    secret.length < 32 ||
    !safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`)
  )
    return new Response("Unauthorized", { status: 401 });
  try {
    return json(await generateDailySummaries());
  } catch (error) {
    return errorResponse(error);
  }
}
