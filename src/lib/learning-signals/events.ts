import {
  learningSignalSchema,
  type ConceptId,
  type LearningSignal,
  type SignalDetail,
} from "./types";
export const SECTION_CONCEPTS: ConceptId[][] = [
  ["trial-population"],
  ["primary-endpoint", "trial-population"],
  ["evidence-limitations"],
];
export const CHALLENGE_CONCEPTS: ConceptId[] = [
  "trial-population",
  "evidence-limitations",
];
export function createLearningSignal(
  sessionId: string,
  detail: SignalDetail,
  conceptIds: ConceptId[],
  options: { id?: string; now?: Date } = {},
): LearningSignal {
  return learningSignalSchema.parse({
    id: options.id ?? crypto.randomUUID(),
    timestamp: (options.now ?? new Date()).toISOString(),
    roundId: "dapa-hf-01",
    topicId: "heart-failure",
    sessionId,
    conceptIds: [...new Set(conceptIds)],
    ...detail,
    ...(detail.type === "evidence_viewed"
      ? { evidenceSourceIds: [detail.sourceId] }
      : {}),
  });
}
