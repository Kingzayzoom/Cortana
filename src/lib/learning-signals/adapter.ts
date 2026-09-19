import type { ConceptId, QuestionCategory } from "./types";
// Text exists only for the duration of this call. Only the returned enum crosses the analytics boundary.
export function classifyQuestion(text: string): QuestionCategory {
  const q = text.toLowerCase();
  if (
    /clarif|explain again|don't understand|do not understand|confus|what do you mean/.test(
      q,
    )
  )
    return "clarification";
  if (
    /population|includ|eligib|diabet|who was|who were|who did|who participated/.test(
      q,
    )
  )
    return "study_population";
  if (/limitat|generaliz|generalis|scope|does not establish/.test(q))
    return "limitation";
  if (/endpoint|outcome|result|findings?/.test(q)) return "endpoint";
  if (/random|blind|placebo|study design|method/.test(q)) return "study_design";
  if (/safe|adverse|side effect|harm/.test(q)) return "safety";
  if (/mechanism|how does|how did.*work/.test(q)) return "mechanism";
  if (/evidence|source|paper|citation|study/.test(q)) return "evidence";
  return "other";
}
export function isQuestion(text: string): boolean {
  return /\?|^(who|what|why|how|where|when|which|was|were|did|does|do|can you|could you|would you|is|are|tell me|help me understand)\b|clarif|explain|don't understand|do not understand/i.test(
    text.trim(),
  );
}
export function conceptsForQuestion(
  category: QuestionCategory,
  current: ConceptId[],
): ConceptId[] {
  if (category === "study_population" || category === "study_design")
    return ["trial-population"];
  if (category === "endpoint") return ["primary-endpoint"];
  if (category === "limitation") return ["evidence-limitations"];
  // Safety and mechanism questions exceed this round's concept catalog.
  if (category === "safety" || category === "mechanism" || category === "other")
    return [];
  return current;
}
