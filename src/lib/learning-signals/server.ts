import type { Progress } from "../learning/types";
import { round } from "../content/round";
import {
  createLearningSignal,
  SECTION_CONCEPTS,
  CHALLENGE_CONCEPTS,
} from "./events";
import { conceptsForQuestion } from "./adapter";
import { ProfileLearningSignalRepository } from "./storage";
import { reduceLearningSignals } from "./reducer";
import type { ConceptId, Observation, SignalDetail } from "./types";

export function signalWriter(data: Progress, now = new Date()) {
  data.learningSignals ??= [];
  const repository = new ProfileLearningSignalRepository(data.learningSignals);
  const run = data.run!;
  const session = () => repository.listForSession(run.id);
  const write = (detail: SignalDetail, concepts: ConceptId[], id?: string) =>
    repository.append(
      createLearningSignal(run.id, detail, concepts, { now, id }),
    );
  const section = () =>
    write(
      {
        type: "briefing_section_viewed",
        sectionId: round.sections[run.section].id as
          "population" | "finding" | "limitation",
      },
      SECTION_CONCEPTS[run.section],
    );
  const start = (mode: "voice" | "preview" = run.mode ?? "preview") => {
    write({ type: "round_started", mode }, SECTION_CONCEPTS[0]);
    if (run.stage === "briefing") section();
  };
  return {
    start,
    section,
    briefingCompleted: () =>
      write({ type: "briefing_completed" }, SECTION_CONCEPTS.flat()),
    grade: (selectedOptionId: "A" | "B" | "C", correct: boolean) => {
      const prior = reduceLearningSignals(data.learningSignals!);
      const attemptNumber =
        data.learningSignals!.filter(
          (event) => event.type === "challenge_attempted",
        ).length + 1;
      write(
        {
          type: "challenge_attempted",
          questionId: "diabetes-eligibility",
          selectedOptionId,
          attemptNumber,
        },
        CHALLENGE_CONCEPTS,
      );
      const added = write(
        {
          type: "challenge_resolved",
          questionId: "diabetes-eligibility",
          correct,
          attemptNumber,
        },
        CHALLENGE_CONCEPTS,
      );
      const reinforced = prior
        .filter(
          (concept) =>
            concept.unresolvedMiss && CHALLENGE_CONCEPTS.includes(concept.id),
        )
        .map((concept) => concept.id);
      if (added && correct && reinforced.length)
        write({ type: "concept_reinforced" }, reinforced);
    },
    complete: () => write({ type: "round_completed" }, []),
    observe: (observation: Observation, id: string) => {
      if (observation.type === "round_started") {
        if (!run.completed) start(observation.mode);
        return;
      }
      // Browsing outside a begun learning session is not counted as round activity.
      if (!session().some((event) => event.type === "round_started")) return;
      const stage = run.stage === "ready" ? "briefing" : run.stage;
      if (observation.type === "briefing_interrupted") {
        if (
          stage !== "briefing" ||
          round.sections[run.section].id !== observation.sectionId
        )
          return;
        write({ ...observation, stage }, SECTION_CONCEPTS[run.section], id);
      } else if (observation.type === "question_asked") {
        if (run.completed) return;
        write(
          { ...observation, stage },
          conceptsForQuestion(
            observation.category,
            stage === "briefing"
              ? SECTION_CONCEPTS[run.section]
              : CHALLENGE_CONCEPTS,
          ),
          id,
        );
      } else {
        const concepts: ConceptId[] =
          observation.sourceId === "dapa-hf"
            ? ["trial-population", "primary-endpoint"]
            : ["trial-population", "evidence-limitations"];
        write({ ...observation, stage }, concepts, id);
      }
    },
  };
}
