import type { LearningSignal } from "./types";
import { reduceLearningSignals, REINFORCEMENT_RULES } from "./reducer";
export function selectLearningSummary(
  input: readonly LearningSignal[],
  sessionId?: string,
) {
  const unique = [...new Map(input.map((event) => [event.id, event])).values()];
  const signals = sessionId
    ? unique.filter((event) => event.sessionId === sessionId)
    : unique;
  const started = signals.find((event) => event.type === "round_started");
  const completed = signals.findLast(
    (event) => event.type === "round_completed",
  );
  const resolved = signals.filter(
    (event) => event.type === "challenge_resolved",
  );
  const concepts = reduceLearningSignals(signals);
  const categories = signals
    .filter((event) => event.type === "question_asked")
    .reduce<Record<string, number>>((all, event) => {
      all[event.category] = (all[event.category] ?? 0) + 1;
      return all;
    }, {});
  return {
    signals,
    concepts,
    conceptsExplored: concepts
      .filter((concept) => concept.explored)
      .map((concept) => concept.id),
    questionsAsked: Object.values(categories).reduce((a, b) => a + b, 0),
    categories,
    evidenceViewed: [
      ...new Set(
        signals
          .filter((event) => event.type === "evidence_viewed")
          .map((event) => event.sourceId),
      ),
    ],
    evidenceFollowUps: signals.filter(
      (event) => event.type === "evidence_viewed",
    ).length,
    attempted: resolved.length,
    correct: resolved.filter((event) => event.correct).length,
    reinforced: [
      ...new Set(
        signals
          .filter((event) => event.type === "concept_reinforced")
          .flatMap((event) => event.conceptIds),
      ),
    ],
    reviewNext: reduceLearningSignals(unique).filter(
      (concept) => concept.priority >= REINFORCEMENT_RULES.considerAt,
    ),
    lastPracticed: resolved.at(-1)?.timestamp ?? null,
    durationSeconds:
      started && completed
        ? Math.max(
            0,
            Math.round(
              (Date.parse(completed.timestamp) -
                Date.parse(started.timestamp)) /
                1000,
            ),
          )
        : null,
    mode: started?.type === "round_started" ? started.mode : null,
  };
}
