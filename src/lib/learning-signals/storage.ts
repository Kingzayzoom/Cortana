// The profile's append-only signal list, with the de-duplication rules that
// stop retries and reconnects from inflating counts.
import { learningSignalSchema, type LearningSignal } from "./types";
interface LearningSignalRepository {
  append(signal: LearningSignal): boolean;
  listForRound(roundId: string): LearningSignal[];
  listForTopic(topicId: string): LearningSignal[];
  listForSession(sessionId: string): LearningSignal[];
}
/** Scoped to a profile transaction. withProgress atomically persists this same array with grades. */
export class ProfileLearningSignalRepository implements LearningSignalRepository {
  constructor(private signals: LearningSignal[]) {}
  append(input: LearningSignal) {
    const signal = learningSignalSchema.parse(input);
    if (this.signals.some((event) => event.id === signal.id)) return false;
    const oncePerSession = [
      "round_started",
      "round_completed",
      "briefing_completed",
      "challenge_attempted",
      "challenge_resolved",
    ];
    if (
      oncePerSession.includes(signal.type) &&
      this.signals.some(
        (event) =>
          event.type === signal.type && event.sessionId === signal.sessionId,
      )
    )
      return false;
    if (
      signal.type === "briefing_section_viewed" &&
      this.signals.some(
        (event) =>
          event.type === signal.type &&
          event.sessionId === signal.sessionId &&
          event.sectionId === signal.sectionId,
      )
    )
      return false;
    this.signals.push(signal);
    return true;
  }
  listForRound(id: string) {
    return this.signals.filter((event) => event.roundId === id);
  }
  listForTopic(id: string) {
    return this.signals.filter((event) => event.topicId === id);
  }
  listForSession(id: string) {
    return this.signals.filter((event) => event.sessionId === id);
  }
}
