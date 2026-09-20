import { conceptId, type ConceptId, type LearningSignal } from "./types";
export const REINFORCEMENT_RULES = {
  incorrect: 3,
  clarification: 2,
  evidenceAfterIncorrect: 1,
  multipleQuestions: 1,
  considerAt: 3,
  reviewNextAt: 5,
} as const;
export type ConceptActivity = {
  id: ConceptId;
  explored: boolean;
  attempts: number;
  correct: number;
  questions: number;
  unresolvedMiss: boolean;
  reinforced: boolean;
  priority: number;
  reasons: string[];
  lastPracticed: string | null;
  status: "NEW" | "EXPLORED" | "PRACTICED" | "REINFORCED" | "REVIEW NEXT";
};
export function reduceLearningSignals(
  signals: readonly LearningSignal[],
): ConceptActivity[] {
  return conceptId.options.map((id) => {
    const state: ConceptActivity = {
      id,
      explored: false,
      attempts: 0,
      correct: 0,
      questions: 0,
      unresolvedMiss: false,
      reinforced: false,
      priority: 0,
      reasons: [],
      lastPracticed: null,
      status: "NEW",
    };
    let clarifications = 0,
      evidenceAfterMiss = false,
      questionsSinceResolution = 0,
      misses = 0;
    const seen = new Set<string>();
    for (const event of signals) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      if (!event.conceptIds.includes(id)) continue;
      state.explored = true;
      if (event.type === "question_asked") {
        state.questions++;
        questionsSinceResolution++;
        if (event.category === "clarification") clarifications++;
      }
      if ((event.type === "evidence_viewed" || event.type==="prime_evidence_viewed") && state.unresolvedMiss)
        evidenceAfterMiss = true;
      if (event.type === "challenge_resolved" || event.type==="prime_question_correct" || event.type==="prime_question_missed") {
        const correct=event.type==="challenge_resolved"?event.correct:event.type==="prime_question_correct";
        state.attempts++;
        state.correct += Number(correct);
        state.lastPracticed = event.timestamp;
        if (!correct) {
          state.unresolvedMiss = true;
          state.reinforced = false;
          misses++;
        } else if (state.unresolvedMiss) {
          state.unresolvedMiss = false;
          state.reinforced = true;
          misses = 0;
          clarifications = 0;
          evidenceAfterMiss = false;
          questionsSinceResolution = 0;
        }
      }
    }
    if (misses) {
      state.priority += misses * REINFORCEMENT_RULES.incorrect;
      state.reasons.push("A previous practice response was incorrect");
    }
    if (clarifications) {
      state.priority += clarifications * REINFORCEMENT_RULES.clarification;
      state.reasons.push("You explicitly asked for clarification");
    }
    if (evidenceAfterMiss) {
      state.priority += REINFORCEMENT_RULES.evidenceAfterIncorrect;
      state.reasons.push("You opened evidence after an incorrect response");
    }
    if (questionsSinceResolution > 1) {
      state.priority += REINFORCEMENT_RULES.multipleQuestions;
      state.reasons.push("You asked multiple questions about this concept");
    }
    state.status =
      state.priority >= REINFORCEMENT_RULES.reviewNextAt
        ? "REVIEW NEXT"
        : state.reinforced
          ? "REINFORCED"
          : state.attempts
            ? "PRACTICED"
            : state.explored
              ? "EXPLORED"
              : "NEW";
    return state;
  });
}
