// What the phone agent can do during a call. ElevenLabs calls these as webhook
// tools through /api/phone/tools/:tool, which checks the credentials in
// ./session first. Like the browser round, the answer key and every write to a
// profile stay here; the agent only relays what it is told.
import { RequestError } from "../errors";
import { withProgress, type StoredProgress } from "../store";
import {
  completeProgress,
  gradeAnswer,
  localDate,
  recordGrade,
  streak,
} from "../../learning/rules";
import { round, sources, unsupportedAnswer } from "../../content/round";
import {
  briefingFor,
  clinician,
  facility,
  notInBriefing,
} from "../../content/briefings";
import { topics } from "../../content/topics";
import { frontDeskRequest, notifyFrontDesk } from "../front-desk";
import type { Run } from "../../learning/types";
import { spokenOption } from "./spoken-option";

// Round tools act only on the run the call was placed for. If the learner has
// since started another round in the browser, the call's tools stop working
// rather than writing into the wrong run.
async function withRun<T>(
  profileId: string,
  runId: string,
  operation: (data: StoredProgress, run: Run) => T,
) {
  return withProgress(profileId, (data) => {
    if (!data.run || data.run.id !== runId)
      throw new RequestError(
        "That round is no longer active. Ask the learner to start a new call from the app.",
        409,
      );
    return operation(data, data.run);
  });
}

export const phoneTools = {
  // The call opens with this. It needs no active round, so a briefing question
  // never fails because the learning round moved on. The briefing is picked
  // from the library by run id, so every call to it in one conversation
  // describes the same patients.
  get_shift_briefing: (runId: string) => ({
    simulated: true,
    disclosure:
      "Say once, early: this briefing is simulated for the demonstration. Then use the patients' names normally and never repeat it.",
    clinician: {
      sayThisName: clinician.spokenName,
      specialty: clinician.specialty,
    },
    facility: { name: facility.name },
    briefing: briefingFor(runId),
    ifAskedForSomethingMissing: notInBriefing,
    youMayNotAdvise:
      "State what the briefing records and who requested it. Do not interpret findings or recommend management.",
  }),

  // The clinician can have a message passed to the front desk. The address and
  // the wording template live on this server; the agent supplies only the words.
  email_front_desk: (request: unknown) => {
    const parsed = frontDeskRequest.safeParse(request);
    if (!parsed.success)
      throw new RequestError(
        "Say why you're sending it (running late, an emergency, or something else), include a short message, and confirm with the clinician first.",
      );
    return notifyFrontDesk(parsed.data);
  },

  // Quizzes may only use topics that actually have a round behind them.
  get_topics: () => ({
    topics: topics.map(({ id, name, available }) => ({ id, name, available })),
    availableNow: topics
      .filter((topic) => topic.available)
      .map(({ id, name, minutes, summary }) => ({
        id,
        name,
        minutes,
        summary,
      })),
    ifUnavailable:
      "Say that topic doesn't have a round yet, and offer one that does.",
  }),

  get_round_context: (profileId: string, runId: string) =>
    withRun(profileId, runId, (data, run) => ({
      learner: {
        name: data.preferences.name,
        streakDays: streak(
          data.practiceDays,
          localDate(new Date(), data.preferences.timezone),
        ),
        roundsCompleted: data.completions.length,
        previousReviewReason: data.review?.reason ?? null,
      },
      round: {
        id: round.id,
        version: round.version,
        title: round.title,
        sections: round.sections.map(({ id, title, text }) => ({
          id,
          title,
          text,
        })),
        case: {
          id: round.case.id,
          description: round.case.description,
          question: round.case.question,
          options: round.case.options,
        },
      },
      sources: sources.map(
        ({ id, shortTitle, publisher, date, excerpt, summary, scope }) => ({
          id,
          shortTitle,
          publisher,
          date,
          excerpt,
          summary,
          scope,
        }),
      ),
      checkpoint: {
        stage: run.stage,
        alreadyGraded: Boolean(run.grade),
        completed: run.completed,
      },
      unsupportedQuestionReply: unsupportedAnswer,
    })),

  submit_answer: (profileId: string, runId: string, answer: string) =>
    withRun(profileId, runId, (data, run) => {
      if (run.grade) return { ...run.grade, alreadyGraded: true };
      const grade = gradeAnswer(spokenOption(answer));
      // An unclear answer is not a grade: ask again rather than guessing.
      if (grade.verdict !== "clarify") recordGrade(data, grade);
      return grade;
    }),

  complete_round: (profileId: string, runId: string) =>
    withRun(profileId, runId, (data, run) => {
      if (!run.grade || run.grade.verdict === "clarify")
        throw new RequestError(
          "Grade the learner's answer with submit_answer before completing the round.",
          409,
        );
      const completionsBefore = data.completions.length;
      if (!run.completed) run.stage = "questions";
      completeProgress(data, new Date());
      return {
        xpTotal: data.completions.reduce((sum, c) => sum + c.xp, 0),
        firstCompletion: data.completions.length > completionsBefore,
        streakDays: streak(
          data.practiceDays,
          localDate(new Date(), data.preferences.timezone),
        ),
        review: data.review,
      };
    }),
};

// Inbound callers (see ./session GUEST_SESSION) get the briefing, the topic
// list and the front desk message, and nothing that reads or writes a
// learner's profile. The front desk is wired in the route, with its own limit.
export const guestTools = {
  // Without a conversation to seed from, the briefing rotates through the
  // library by the hour: steady inside one call, different later in the day.
  get_shift_briefing: (conversationId: string) => ({
    ...phoneTools.get_shift_briefing(conversationId),
    guest: true,
    unavailableOnThisCall:
      "Saving progress and grading answers need the learner's own profile. Offer to call them back from the app instead. Passing a message to the front desk still works.",
  }),
  get_topics: () => phoneTools.get_topics(),
};
