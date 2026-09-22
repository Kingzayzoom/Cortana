// Picks the day's three Prime questions: reinforcement, then due reviews, then
// new concepts, preferring distinct concepts and avoiding recent repeats.
import type { PrimeQuestion, PrimeState, Selection } from "./types";
import type { EducationTrigger } from "../context/types";
import type { LearningSignal } from "../learning-signals/types";
import { reduceLearningSignals } from "../learning-signals/reducer";
// Why a question is chosen, in priority order.
const REASONS = ["reinforcement", "review", "new", "practice"] as const;

export function buildDailyPrime(
  state: PrimeState,
  bank: PrimeQuestion[],
  today: string,
  triggers: EducationTrigger[] = [],
  history: LearningSignal[] = [],
): Selection[] {
  const recent = new Set(
    state.sessions
      .slice(-2)
      .flatMap((s) => s.selection.map((q) => q.questionId)),
  );
  const contextRelevant = triggers.some(
    (t) => t.roundId === "dapa-hf-01" || /^heart failure$/i.test(t.topic),
  );
  // Rotate the bank by a hash of the date: ties break differently each day,
  // but rebuilding the same day gives the same set. No randomness to test around.
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
  const activity = reduceLearningSignals(history);

  const reasonFor = (q: PrimeQuestion): Selection["reason"] => {
    const concept = q.conceptIds[0];
    const review = state.reviews[concept];
    // A miss in the evidence round counts too, until Prime has its own review.
    const missed = activity.find((c) => c.id === concept)?.unresolvedMiss;
    if (review?.needsReinforcement || (!review && missed))
      return "reinforcement";
    if (review && review.nextReviewAt <= today) return "review";
    return review ? "practice" : "new";
  };

  const used = new Set<string>(),
    concepts = new Set<string>();
  const result: Selection[] = [];
  for (let i = 0; i < 3; i++) {
    // Lower is better: the reason first, then a concept not yet in today's
    // set (weighted far above everything), then not asked in the last two days.
    const score = (q: PrimeQuestion) =>
      REASONS.indexOf(reasonFor(q)) * 100 +
      (concepts.has(q.conceptIds[0]) ? 1000 : 0) +
      (recent.has(q.id) ? 20 : 0);
    const q = candidates
      .filter((q) => !used.has(q.id))
      .sort((a, b) => score(a) - score(b))[0];
    if (!q) break;
    result.push({ questionId: q.id, reason: reasonFor(q), contextRelevant });
    used.add(q.id);
    q.conceptIds.forEach((c) => concepts.add(c));
  }
  return result;
}
