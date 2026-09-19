import { getRound } from "@/lib/content"
import { answerFromEvidence, GeminiUnavailableError } from "@/lib/gemini/grounded"
import { askRequest } from "@/lib/validation/tools"

const STATUS: Record<GeminiUnavailableError["code"], number> = {
  not_configured: 503,
  rate_limited: 429,
  upstream_error: 502,
  bad_output: 502,
}

// Typed questions when voice isn't connected. Answers come from the round's
// curated evidence only.
export async function POST(request: Request, ctx: RouteContext<"/api/rounds/[roundId]/ask">) {
  const { roundId } = await ctx.params
  const round = getRound(roundId)
  if (!round) return Response.json({ error: "round_not_found" }, { status: 404 })

  const body = askRequest.safeParse(await request.json().catch(() => null))
  if (!body.success) return Response.json({ error: "invalid_request", issues: body.error.issues }, { status: 400 })

  try {
    return Response.json(await answerFromEvidence(round, body.data.question))
  } catch (err) {
    if (err instanceof GeminiUnavailableError) {
      if (err.code !== "not_configured") console.error("[rounds/ask]", err.code, err.message)
      return Response.json({ error: err.code, message: err.message }, { status: STATUS[err.code] })
    }
    throw err
  }
}
