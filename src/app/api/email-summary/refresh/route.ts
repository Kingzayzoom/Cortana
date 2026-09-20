import { generateOwnSummary } from "@/lib/server/email-summary";
import { assertOrigin, rateLimit, safeError } from "@/lib/server/session";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    assertOrigin(request);
    await rateLimit("email-summary:refresh", 60, 60_000);
    return Response.json(await generateOwnSummary(), {
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch (error) {
    const response = safeError(error);
    response.headers.set("Cache-Control", "no-store, private");
    return response;
  }
}
