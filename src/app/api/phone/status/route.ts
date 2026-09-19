import {
  assertOrigin,
  profileSession,
  rateLimit,
  RequestError,
  safeError,
} from "@/lib/server/session";
import { withProgress } from "@/lib/server/store";
import { phoneConfigured } from "@/lib/server/phone";
export const runtime = "nodejs";
// Lets the page follow its own call. A profile can only ask about the
// conversation stored on its current run.
export async function GET(request: Request) {
  try {
    assertOrigin(request);
    const id = await profileSession();
    if (!id) throw new RequestError("Refresh the workspace.", 401);
    await rateLimit(`phone-status:${id}`, 120);
    const conversationId = new URL(request.url).searchParams.get(
      "conversationId",
    );
    if (!conversationId) throw new RequestError("No call was named.");
    const owned = await withProgress(
      id,
      (data) => data.run?.phone?.conversationId === conversationId,
    );
    if (!owned)
      throw new RequestError("That call is not yours to follow.", 403);
    if (!phoneConfigured())
      throw new RequestError("Phone rounds are not configured.", 503);
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(conversationId)}`,
      {
        headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      },
    ).catch(() => null);
    if (!response?.ok)
      throw new RequestError(
        "The call status is unavailable right now.",
        response?.status === 404 ? 404 : 502,
      );
    const body = await response.json().catch(() => null);
    const status = (body as { status?: string } | null)?.status ?? "unknown";
    return Response.json(
      { status },
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (error) {
    const response = safeError(error);
    response.headers.set("Cache-Control", "no-store, private");
    return response;
  }
}
