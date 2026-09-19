import {
  reduceLearningSignals,
  type ConceptActivity,
} from "../learning-signals/reducer";
import type { ConceptId, LearningSignal } from "../learning-signals/types";
export const supportedRounds = [
  {
    id: "dapa-hf-01",
    topic: "Heart failure",
    specialty: "Cardiology",
    conceptIds: [
      "trial-population",
      "primary-endpoint",
      "evidence-limitations",
    ] as ConceptId[],
  },
];
export type SupportedRound = (typeof supportedRounds)[number];
export function selectNextRound(
  signals: readonly LearningSignal[],
  rounds: readonly SupportedRound[] = supportedRounds,
  priorities: readonly ConceptActivity[] = reduceLearningSignals(signals),
  lastPracticeTimes: Partial<Record<string, string>> = {},
  now = new Date(),
): {
  roundId: string;
  reason: string;
  conceptIds: ConceptId[];
  kind: "reinforcement" | "missed" | "overdue" | "new" | "practice";
} | null {
  if (!rounds.length) return null;
  const eligible = priorities
    .filter((concept) =>
      rounds.some((round) => round.conceptIds.includes(concept.id)),
    )
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const priority =
    eligible.find((concept) => concept.priority >= 5) ??
    eligible.find((concept) => concept.unresolvedMiss);
  if (priority) {
    const round = rounds.find((item) => item.conceptIds.includes(priority.id))!;
    return {
      roundId: round.id,
      conceptIds: [priority.id],
      reason:
        priority.reasons.join(". ") + ". Revisit the supported DAPA-HF round.",
      kind: priority.priority >= 5 ? "reinforcement" : "missed",
    };
  }
  const last = (round: SupportedRound) =>
    lastPracticeTimes[round.id] ??
    signals.findLast(
      (event) =>
        event.roundId === round.id && event.type === "challenge_resolved",
    )?.timestamp;
  const overdue = rounds
    .filter((round) => {
      const date = last(round);
      return date && now.getTime() - Date.parse(date) >= 7 * 86400000;
    })
    .sort((a, b) => Date.parse(last(a)!) - Date.parse(last(b)!))[0];
  if (overdue)
    return {
      roundId: overdue.id,
      conceptIds: overdue.conceptIds,
      reason:
        "It has been at least seven days since your last practice in this supported round.",
      kind: "overdue",
    };
  const unseen = rounds.find(
    (round) => !signals.some((event) => event.roundId === round.id),
  );
  if (unseen)
    return {
      roundId: unseen.id,
      conceptIds: unseen.conceptIds,
      reason:
        "First-round demo selection: the reviewed DAPA-HF evidence bundle. No learning history was used.",
      kind: "new",
    };
  const round = rounds[0];
  const consider = eligible.find((concept) => concept.priority >= 3);
  return {
    roundId: round.id,
    conceptIds: consider ? [consider.id] : round.conceptIds,
    reason: consider
      ? consider.reasons.join(". ") +
        ". Consider revisiting this concept in the supported round."
      : signals.some((event) => event.type === "challenge_resolved")
        ? "Your recent practice is saved. DAPA-HF is the only supported round; repeat it when useful. No additional topic is recommended."
        : "Continue the supported DAPA-HF round you have started exploring. No practice outcome has been recorded yet.",
    kind: "practice",
  };
}
