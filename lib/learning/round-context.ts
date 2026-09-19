import { getCase, getSource, type Round, type Source } from "@/lib/content"

/**
 * The evidence the model is allowed to use for a round, in one shape for both
 * the voice agent (get_round_context) and server-side Gemini calls. Contains
 * no answer key.
 */
export function buildRoundContext(round: Round) {
  const clinicalCase = getCase(round.caseId)
  const sources = round.sourceIds.map(getSource).filter((s): s is Source => Boolean(s))

  return {
    round: {
      id: round.id,
      title: round.title,
      specialty: round.specialty,
      focus: round.focus,
      estimated_minutes: round.estimatedMinutes,
    },
    briefing_sections: round.sections.map((s) => ({
      section_id: s.id,
      title: s.title,
      points: s.points,
      source_ids: s.sourceIds,
    })),
    case: clinicalCase && {
      case_id: clinicalCase.id,
      question_id: clinicalCase.questionId,
      label: clinicalCase.label,
      patient: clinicalCase.patient,
      findings: clinicalCase.findings,
      question: clinicalCase.question,
      options: clinicalCase.options.map((o) => `${o.id}. ${o.text}`),
    },
    sources: sources.map((s) => ({
      source_id: s.id,
      title: s.title,
      citation: `${s.publisher}, ${s.year} — ${s.citation}`,
      summary: s.summary,
      key_points: s.keyPoints,
      limitations: s.limitations,
    })),
  }
}

export type RoundContext = ReturnType<typeof buildRoundContext>
