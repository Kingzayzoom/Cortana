import { getCase, getRound } from "@/lib/content"
import { gradeAnswer } from "@/lib/learning/grading"
import { answerRequest } from "@/lib/validation/tools"

// One grading path for voice, click and typed answers.
export async function POST(request: Request, ctx: RouteContext<"/api/rounds/[roundId]/answer">) {
  const { roundId } = await ctx.params
  const round = getRound(roundId)
  if (!round) return Response.json({ error: "round_not_found" }, { status: 404 })

  const body = answerRequest.safeParse(await request.json().catch(() => null))
  if (!body.success) return Response.json({ error: "invalid_request", issues: body.error.issues }, { status: 400 })

  if (getCase(round.caseId)?.questionId !== body.data.questionId) {
    return Response.json({ error: "question_not_in_round" }, { status: 400 })
  }

  const grade = gradeAnswer(round.id, body.data.questionId, body.data.answer)
  if (!grade) return Response.json({ error: "answer_key_missing" }, { status: 500 })
  return Response.json(grade)
}
