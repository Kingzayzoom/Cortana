import type { PrimeQuestion, PrimeState, Selection } from "./types";
import type { EducationTrigger } from "../context/types";
import type { LearningSignal } from "../learning-signals/types";
import { reduceLearningSignals } from "../learning-signals/reducer";
export function buildDailyPrime(
  state: PrimeState,
  bank: PrimeQuestion[],
  today: string,
  triggers: EducationTrigger[] = [],
  history: LearningSignal[] = [],
): Selection[] {
  const used = new Set<string>(),
    concepts = new Set<string>();
  const recent = new Set(
    state.sessions
      .slice(-2)
      .flatMap((s) => s.selection.map((q) => q.questionId)),
  );
  const contextRelevant = triggers.some(
    (t) => t.roundId === "dapa-hf-01" || /^heart failure$/i.test(t.topic),
  );
  const offset = [...today].reduce((n, c) => n + c.charCodeAt(0), 0);
  const rotated = bank.length
    ? [
        ...bank.slice(offset % bank.length),
        ...bank.slice(0, offset % bank.length),
      ]
    : [];
  const candidates = rotated.filter(
    (q, i, a) => a.findIndex((x) => x.id === q.id) === i,
  );
  const result: Selection[] = [];
  const activity = reduceLearningSignals(history);
  for (let i = 0; i < 3; i++) {
    const eligible = candidates.filter((q) => !used.has(q.id));
    const score = (q: PrimeQuestion) => {
      const review = state.reviews[q.conceptIds[0]];
      const signalMiss = activity.find(
        (c) => c.id === q.conceptIds[0],
      )?.unresolvedMiss;
      const priority =
        review?.needsReinforcement || (!review && signalMiss)
          ? 0
          : review && review.nextReviewAt <= today
            ? 1
            : !review
              ? 2
              : 3;
      return (
        priority * 100 +
        (concepts.has(q.conceptIds[0]) ? 1000 : 0) +
        (recent.has(q.id) ? 20 : 0)
      );
    };
    eligible.sort((a, b) => score(a) - score(b));
    const q = eligible[0];
    if (!q) break;
    const review = state.reviews[q.conceptIds[0]];
    const missed = activity.find(
      (c) => c.id === q.conceptIds[0],
    )?.unresolvedMiss;
    result.push({
      questionId: q.id,
      reason:
        review?.needsReinforcement || (!review && missed)
          ? "reinforcement"
          : review && review.nextReviewAt <= today
            ? "review"
            : !review
              ? "new"
              : "practice",
      contextRelevant,
    });
    used.add(q.id);
    q.conceptIds.forEach((c) => concepts.add(c));
  }
  return result;
}
