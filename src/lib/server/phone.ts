import { randomUUID } from "node:crypto";
import { z } from "zod";
import { RequestError } from "./errors";
import { hmac, safeEqual } from "./session";
import { withProgress, type StoredProgress } from "./store";
import {
  completeProgress,
  gradeAnswer,
  localDate,
  streak,
} from "../learning/rules";
import {
  CONTENT_VERSION,
  ROUND_ID,
  round,
  sources,
  unsupportedAnswer,
} from "../content/round";
import { facility } from "../content/briefing";
import { briefingFor, clinician, notInBriefing } from "../content/briefings";
import { topics } from "../content/topics";
import { frontDeskRequest, notifyFrontDesk } from "./email";
import type { Run } from "../learning/types";
import { setting } from "./env";

// A phone round runs the same lesson as the browser, but ElevenLabs reaches this
// server directly: a phone has no browser to host client tools. Each call carries
// a short-lived signed session that names the profile and run it may touch.
const SESSION_TTL_MS = 45 * 60 * 1000;
// Twilio is a native ElevenLabs integration; every other carrier (Telnyx,
// Plivo, SignalWire, …) arrives as a SIP trunk. Same request, different path.
const callEndpoint = () =>
  `https://api.elevenlabs.io/v1/convai/${
    setting("PHONE_PROVIDER") === "sip" ? "sip-trunk" : "twilio"
  }/outbound-call`;

export function phoneConfigured() {
  return Boolean(
    process.env.ELEVENLABS_API_KEY &&
    process.env.ELEVENLABS_PHONE_AGENT_ID &&
    process.env.ELEVENLABS_PHONE_NUMBER_ID &&
    (setting("PHONE_TOOL_SECRET")?.length ?? 0) >= 32 &&
    (setting("DEMO_ACCESS_CODE")?.length ?? 0) >= 12 &&
    (setting("SESSION_SECRET")?.length ?? 0) >= 32,
  );
}

export async function createPhoneSession(profileId: string, runId: string) {
  const payload = Buffer.from(
    JSON.stringify({ p: profileId, r: runId, e: Date.now() + SESSION_TTL_MS }),
  ).toString("base64url");
  return `${payload}.${await hmac(`phone:${payload}`)}`;
}

// Someone who dials the number has no profile behind them, so the agent sends
// this instead of a signed session. They can hear a briefing and ask about it;
// nothing that writes to a learner's progress is available.
export const GUEST_SESSION = "guest-inbound-caller";

export const guestTools = {
  // Without a conversation to seed from, the briefing rotates through the
  // library by the hour: steady inside one call, different later in the day.
  get_shift_briefing: (conversationId: string) => ({
    ...phoneTools.get_shift_briefing(conversationId),
    guest: true,
    unavailableOnThisCall:
      "Saving progress, grading answers and messaging the front desk need the learner's own profile. Offer to call them back from the app instead.",
  }),
  get_topics: () => phoneTools.get_topics(),
};

export async function readPhoneSession(token: string) {
  const [payload, signature] = token.split(".");
  const unknown = new RequestError("This call session is not recognized.", 401);
  if (!payload || !signature) throw unknown;
  if (!safeEqual(await hmac(`phone:${payload}`), signature)) throw unknown;
  let data: { p?: unknown; r?: unknown; e?: unknown };
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw unknown;
  }
  if (typeof data.p !== "string" || typeof data.r !== "string") throw unknown;
  if (typeof data.e !== "number" || Date.now() > data.e)
    throw new RequestError("This call session has expired.", 401);
  return { profileId: data.p, runId: data.r };
}

// Proves a tool request came from the configured agent, not the open internet.
export function assertToolSecret(request: Request) {
  const secret = setting("PHONE_TOOL_SECRET");
  if (
    !secret ||
    !safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`)
  )
    throw new RequestError("This tool request is not authorized.", 401);
}

export const phoneCallRequest = z
  .object({
    accessCode: z.string().max(200),
    // E.164, the format ElevenLabs and Twilio expect.
    phoneNumber: z
      .string()
      .trim()
      .regex(
        /^\+[1-9]\d{7,14}$/,
        "Enter the number in international format, for example +15715550123.",
      ),
    consent: z.literal(true),
    permission: z.literal(true),
    mode: z.enum(["round", "context", "prime"]).default("round"),
  })
  .strict();

export const maskNumber = (number: string) =>
  `${number.slice(0, 2)}${"•".repeat(Math.max(number.length - 4, 0))}${number.slice(-2)}`;

export async function startOutboundCall(
  phoneNumber: string,
  dynamicVariables: Record<string, string>,
) {
  let response: Response;
  try {
    response = await fetch(callEndpoint(), {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        agent_id: process.env.ELEVENLABS_PHONE_AGENT_ID,
        agent_phone_number_id: process.env.ELEVENLABS_PHONE_NUMBER_ID,
        to_number: phoneNumber,
        conversation_initiation_client_data: {
          dynamic_variables: dynamicVariables,
        },
      }),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      ["TimeoutError", "AbortError"].includes(error.name)
    )
      throw new RequestError("The call request timed out. Please retry.", 504);
    throw new RequestError(
      "The server could not reach ElevenLabs to place the call.",
      502,
    );
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    // Inspect only to choose one of our own fixed messages; never forward the body.
    const detail = JSON.stringify(body ?? {}).toLowerCase();
    if (/unverified|verified caller|trial/.test(detail))
      throw new RequestError(
        "The carrier account is on a trial and can only call verified numbers. Verify this number with the carrier, or add funds to the account.",
        400,
      );
    if (/invalid|not a valid phone|to_number/.test(detail))
      throw new RequestError(
        "That phone number was rejected. Check the country code and digits.",
        400,
      );
    if (
      [402, 429].includes(response.status) ||
      /quota|billing|credit|balance|insufficient/.test(detail)
    )
      throw new RequestError(
        "The ElevenLabs or Twilio account has reached a usage or billing limit.",
        429,
      );
    if ([401, 403].includes(response.status))
      throw new RequestError(
        "ElevenLabs denied the call request. Check the API key and the phone number's permissions.",
        502,
      );
    if (response.status === 404)
      throw new RequestError(
        "The configured phone agent or phone number was not found in ElevenLabs.",
        502,
      );
    throw new RequestError(
      "ElevenLabs could not place the call. Check the phone agent configuration and retry.",
      502,
    );
  }
  const payload = z
    .object({
      success: z.boolean().optional(),
      message: z.string().optional(),
      conversation_id: z.string().nullable().optional(),
      // Twilio returns callSid; a SIP trunk returns sip_call_id.
      callSid: z.string().nullable().optional(),
      sip_call_id: z.string().nullable().optional(),
    })
    .safeParse(body);
  if (!payload.success || payload.data.success === false)
    throw new RequestError(
      "ElevenLabs did not start the call. Check the phone number and agent, then retry.",
      502,
    );
  return { conversationId: payload.data.conversation_id ?? null };
}

// People answer a phone in sentences ("I'd go with B"), while the grader expects
// one option. Pull out a single option when the speech names exactly one, and
// leave anything ambiguous untouched so the server still asks them to clarify.
export function spokenOption(answer: string) {
  const text = answer.toLowerCase().replace(/[.,!?;:]/g, " ");
  const words = text.trim().split(/\s+/).filter(Boolean);
  const found = new Set<string>();
  for (const option of round.case.options)
    if (
      text.includes(
        option.text
          .toLowerCase()
          .replace(/[.,!?;:]/g, " ")
          .trim(),
      )
    )
      found.add(option.id);
  for (const [, letter] of text.matchAll(
    /\b(?:option|answer|choice|letter)\s+([abc])\b/g,
  ))
    found.add(letter.toUpperCase());
  // "b" and "c" are not English words; a lone "a" usually is, so only trust it
  // in a very short reply.
  for (const [, letter] of text.matchAll(/\b([bc])\b/g))
    found.add(letter.toUpperCase());
  if (words.length <= 3 && /\ba\b/.test(text)) found.add("A");
  const ordinals: Record<string, string> = {
    first: "A",
    second: "B",
    third: "C",
  };
  // "the second one" picks an option; "between the first and the second" does not.
  const choosing =
    words.length <= 4 ||
    /\b(one|option|answer|choice|pick|choose)\b|\bgo with\b/.test(text);
  if (choosing)
    for (const [, word] of text.matchAll(/\b(first|second|third)\b/g))
      found.add(ordinals[word]);
  return found.size === 1 ? [...found][0] : answer;
}

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

// The lesson content and authority the phone agent is allowed to use. The answer
// key stays on this server, exactly as in the browser round.
export const phoneTools = {
  // The call opens with this. It needs no active round, so a briefing question
  // can never fail because the learning round moved on.
  // One briefing per call, chosen from the library by the run it belongs to,
  // so every tool call in a conversation describes the same patients.
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
      if (grade.verdict === "clarify") return grade;
      run.grade = grade;
      run.stage = "feedback";
      data.attempts.push({
        id: randomUUID(),
        roundId: ROUND_ID,
        version: CONTENT_VERSION,
        answerId: grade.answerId!,
        correct: grade.verdict === "correct",
        at: new Date().toISOString(),
      });
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
