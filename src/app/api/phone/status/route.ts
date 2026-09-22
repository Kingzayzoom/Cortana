// GET /api/phone/status?conversationId= — polled by the call page to show the
// live transcript to the room while one person holds the phone.
import {
  assertOrigin,
  errorResponse,
  json,
  rateLimit,
  requireProfile,
} from "@/lib/server/http";
import { RequestError } from "@/lib/server/errors";
import { withProgress } from "@/lib/server/store";
import { phoneConfigured } from "@/lib/server/phone/outbound";
export const runtime = "nodejs";
// Tool calls worth showing the room. Anything else stays behind the scenes.
const ACTIONS: Record<string, string> = {
  get_shift_briefing: "Loaded the shift briefing",
  get_topics: "Checked which topics have a round",
  get_round_context: "Opened the evidence round",
  submit_answer: "Sent the answer to the server for grading",
  complete_round: "Saved the completed round",
  email_front_desk: "Sent a message to the front desk",
  get_context_summary: "Loaded the active scenario",
  get_prime_session: "Opened today's practice",
  submit_prime_answer: "Graded a practice answer on the server",
  complete_prime: "Saved today's practice",
};
// A profile can only follow the conversation stored on its own current run.
export async function GET(request: Request) {
  try {
    assertOrigin(request);
    const id = await requireProfile("Refresh the workspace.");
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
    const body = (await response.json().catch(() => null)) as {
      status?: string;
      transcript?: {
        role?: string;
        message?: string | null;
        tool_calls?: { tool_name?: string }[];
      }[];
    } | null;
    // The room watches the call on screen while one person holds the phone,
    // so the page gets the words plus a note when Samantha acts on a request.
    const transcript = (body?.transcript ?? []).flatMap((line, index) => {
      const rows = [];
      const text = line.message?.trim();
      if (text)
        rows.push({
          id: `${index}-said`,
          role: line.role === "agent" ? "samantha" : "caller",
          text,
        });
      for (const call of line.tool_calls ?? [])
        if (call.tool_name && ACTIONS[call.tool_name])
          rows.push({
            id: `${index}-${call.tool_name}`,
            role: "action",
            text: ACTIONS[call.tool_name],
          });
      return rows;
    });
    return json({ status: body?.status ?? "unknown", transcript });
  } catch (error) {
    return errorResponse(error);
  }
}
