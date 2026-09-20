import { generateDailySummaries } from "@/lib/server/email-summary";
import { safeEqual, safeError } from "@/lib/server/session";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 ||
      !safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`))
    return new Response("Unauthorized", { status: 401 });
  try {
    return Response.json(await generateDailySummaries(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const response = safeError(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
