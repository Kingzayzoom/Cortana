import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ profile: "phone-profile-1" }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined, set: vi.fn() })),
}));
vi.mock("../src/lib/server/session", async (original) => {
  const actual = await original<typeof import("../src/lib/server/session")>();
  return {
    ...actual,
    profileSession: vi.fn(async () => state.profile),
    rateLimit: vi.fn(),
  };
});

import { POST as call } from "../src/app/api/phone/call/route";
import { POST as tool } from "../src/app/api/phone/tools/[tool]/route";
import {
  createPhoneSession,
  maskNumber,
  spokenOption,
} from "../src/lib/server/phone";
import { withProgress } from "../src/lib/server/store";
import { setActiveScenario } from "../src/lib/context/store";
import { demoScenarios } from "../src/lib/context/demo";
import {
  buildPhoneBriefingContext,
  CONTEXT_FALLBACK,
} from "../src/lib/context/selectors";
import { POST as webContextTool } from "../src/app/api/context/tools/[tool]/route";
import {
  PUT as uploadContext,
  GET as activeContext,
} from "../src/app/api/context/route";

const TOOL_SECRET = "t".repeat(40);
const callBody = {
  accessCode: "private-demo-code",
  phoneNumber: "+15715550123",
  consent: true,
  permission: true,
};
const callRequest = (overrides: Record<string, unknown> = {}) =>
  new Request("http://localhost:3100/api/phone/call", {
    method: "POST",
    headers: {
      origin: "http://localhost:3100",
      host: "localhost:3100",
      "content-type": "application/json",
    },
    body: JSON.stringify({ ...callBody, ...overrides }),
  });
const toolRequest = (
  name: string,
  body: Record<string, unknown>,
  secret = TOOL_SECRET,
) => ({
  request: new Request(`http://localhost:3100/api/phone/tools/${name}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  }),
  context: { params: Promise.resolve({ tool: name }) },
});
const accepted = () =>
  Response.json({
    success: true,
    message: "ok",
    conversation_id: "conv_123",
    callSid: "CA123",
  });

beforeEach(async () => {
  vi.stubEnv("ELEVENLABS_API_KEY", "sk_test_secret_never_returned");
  vi.stubEnv("ELEVENLABS_PHONE_AGENT_ID", "agent_phone_test");
  vi.stubEnv("ELEVENLABS_PHONE_NUMBER_ID", "phnum_test");
  vi.stubEnv("CORTANA_PHONE_TOOL_SECRET", TOOL_SECRET);
  vi.stubEnv("CORTANA_DEMO_ACCESS_CODE", "private-demo-code");
  vi.stubEnv("CORTANA_SESSION_SECRET", "s".repeat(48));
  vi.stubEnv("CORTANA_DATA_DIR", await mkdtemp(path.join(tmpdir(), "phone-")));
  vi.stubGlobal("fetch", vi.fn(accepted));
  state.profile = `phone-${Math.random().toString(16).slice(2)}`;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function startedSession() {
  await call(callRequest());
  const runId = await withProgress(state.profile, (data) => data.run!.id);
  return createPhoneSession(state.profile, runId);
}

describe("Placing a phone round", () => {
  it("runs Prime through signed phone tools against the same saved session", async () => {
    expect((await call(callRequest({ mode: "prime" }))).status).toBe(200);
    const sent = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    const variables =
      sent.conversation_initiation_client_data.dynamic_variables;
    expect(variables.context_mode).toBe("prime");
    const get = toolRequest("get_prime_session", {
      session: variables.phone_session,
    });
    const current = await (await tool(get.request, get.context)).json();
    expect(current.questions).toHaveLength(3);
    expect(JSON.stringify(current.questions)).not.toContain("correctOptionId");
    const answer = toolRequest("submit_prime_answer", {
      session: variables.phone_session,
      sessionId: current.session.id,
      questionId: current.questions[0].id,
      answer: "Option A",
    });
    const response = await tool(answer.request, answer.context);
    expect(response.status).toBe(200);
    expect((await response.json()).stats.questions).toBe(1);
  });
  it("validates streamed uploads server-side and preserves the last valid context", async () => {
    const upload = (body: string, origin = "http://localhost:3100") =>
      new Request("http://localhost:3100/api/context", {
        method: "PUT",
        headers: { origin, host: "localhost:3100" },
        body,
      });
    expect(
      (await uploadContext(upload(JSON.stringify(demoScenarios[1])))).status,
    ).toBe(200);
    expect((await uploadContext(upload("{bad json"))).status).toBe(400);
    const invalid = await uploadContext(
      upload(JSON.stringify({ ...demoScenarios[0], synthetic: false })),
    );
    expect(invalid.status).toBe(400);
    expect(
      (await invalid.json()).issues.some(
        (i: { path: string }) => i.path === "synthetic",
      ),
    ).toBe(true);
    expect((await uploadContext(upload(" ".repeat(65537)))).status).toBe(413);
    expect(
      (
        await uploadContext(
          upload(JSON.stringify(demoScenarios[0]), "https://other.example"),
        )
      ).status,
    ).toBe(403);
    expect((await (await activeContext()).json()).activeScenario.id).toBe(
      demoScenarios[1].id,
    );
  });
  it("sends the active context briefing and retrieves identical scoped facts on web and phone", async () => {
    await setActiveScenario(state.profile, demoScenarios[1]);
    expect((await call(callRequest({ mode: "context" }))).status).toBe(200);
    const sent = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    const variables =
      sent.conversation_initiation_client_data.dynamic_variables;
    expect(variables.context_mode).toBe("context");
    expect(JSON.parse(variables.context_briefing)).toEqual(
      buildPhoneBriefingContext(demoScenarios[1]),
    );
    const input = toolRequest("get_context_summary", {
      session: variables.phone_session,
    });
    const phone = await tool(input.request, input.context);
    const web = await webContextTool(
      new Request(
        "http://localhost:3100/api/context/tools/get_context_summary",
        {
          method: "POST",
          headers: { origin: "http://localhost:3100", host: "localhost:3100" },
          body: "{}",
        },
      ),
      input.context,
    );
    expect(await phone.json()).toEqual(await web.json());
    await setActiveScenario(state.profile, null);
    const cleared = toolRequest("get_context_summary", {
      session: variables.phone_session,
    });
    expect(
      await (await tool(cleared.request, cleared.context)).json(),
    ).toMatchObject({ available: false, message: CONTEXT_FALLBACK });
    expect((await call(callRequest({ mode: "context" }))).status).toBe(409);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects unknown case sections and stale phone context sessions", async () => {
    const session = await startedSession();
    const bad = toolRequest("get_case_section", {
      session,
      caseId: "patient-024",
      section: "secrets",
    });
    expect((await tool(bad.request, bad.context)).status).toBe(400);
    await withProgress(state.profile, (data) => {
      data.run!.completed = true;
    });
    const stale = toolRequest("get_primary_case", { session });
    expect((await tool(stale.request, stale.context)).status).toBe(409);
  });
  it("asks ElevenLabs to call the number with a session the tools can verify", async () => {
    const response = await call(callRequest());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ conversationId: "conv_123" });
    expect(body.calling).toBe(maskNumber(callBody.phoneNumber));
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    const [url, options] = vi.mocked(fetch).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toContain("/v1/convai/twilio/outbound-call");
    expect((options.headers as Record<string, string>)["xi-api-key"]).toBe(
      "sk_test_secret_never_returned",
    );
    const sent = JSON.parse(options.body as string);
    expect(sent).toMatchObject({
      agent_id: "agent_phone_test",
      agent_phone_number_id: "phnum_test",
      to_number: "+15715550123",
    });
    const variables =
      sent.conversation_initiation_client_data.dynamic_variables;
    expect(variables.phone_session).toMatch(/^[\w-]+\.[0-9a-f]{64}$/);
    // The stored run remembers the conversation but never the phone number.
    const run = await withProgress(state.profile, (data) => data.run!);
    expect(run.phone?.conversationId).toBe("conv_123");
    expect(JSON.stringify(run)).not.toContain("5715550123");
  });

  it("rejects a bad number, a wrong code and unconfigured phone rounds", async () => {
    const bad = await call(callRequest({ phoneNumber: "571-555-0123" }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toMatch(/international format/);
    const wrongCode = await call(callRequest({ accessCode: "nope" }));
    expect(wrongCode.status).toBe(403);
    const noConsent = await call(callRequest({ consent: false }));
    expect(noConsent.status).toBe(400);
    vi.stubEnv("ELEVENLABS_PHONE_NUMBER_ID", "");
    const unconfigured = await call(callRequest());
    expect(unconfigured.status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses the SIP trunk endpoint for non-Twilio carriers", async () => {
    vi.stubEnv("CORTANA_PHONE_PROVIDER", "sip");
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        success: true,
        message: "ok",
        conversation_id: "conv_sip",
        sip_call_id: "sip_1",
      }),
    );
    const response = await call(callRequest());
    expect(response.status).toBe(200);
    expect((await response.json()).conversationId).toBe("conv_sip");
    const [url, options] = vi.mocked(fetch).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toContain("/v1/convai/sip-trunk/outbound-call");
    // The request body is identical, so the rest of the flow is unchanged.
    expect(JSON.parse(options.body as string)).toMatchObject({
      agent_id: "agent_phone_test",
      to_number: "+15715550123",
    });
  });

  it("explains a carrier trial rejection without leaking the provider response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json(
        { detail: "The number is unverified on this trial account (secret)" },
        { status: 400 },
      ),
    );
    const response = await call(callRequest());
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toMatch(/trial/);
    expect(JSON.stringify(body)).not.toContain("secret");
  });
});

describe("Phone agent tools", () => {
  it("refuses requests without the shared secret", async () => {
    const session = await startedSession();
    const { request, context } = toolRequest(
      "get_round_context",
      { session },
      "wrong-secret",
    );
    const response = await tool(request, context);
    expect(response.status).toBe(401);
    const missing = await tool(
      new Request("http://localhost:3100/api/phone/tools/get_round_context", {
        method: "POST",
        body: "{}",
      }),
      { params: Promise.resolve({ tool: "get_round_context" }) },
    );
    expect(missing.status).toBe(401);
  });

  it("refuses a tampered, foreign or expired session", async () => {
    const session = await startedSession();
    const tampered = `${session.slice(0, -1)}${session.at(-1) === "a" ? "b" : "a"}`;
    const { request, context } = toolRequest("get_round_context", {
      session: tampered,
    });
    expect((await tool(request, context)).status).toBe(401);
    // A valid signature for a run that is no longer current cannot act either.
    const stale = await createPhoneSession(
      state.profile,
      "11111111-1111-4111-8111-111111111111",
    );
    const other = toolRequest("get_round_context", { session: stale });
    expect((await tool(other.request, other.context)).status).toBe(409);
  });

  it("serves the lesson without the answer key", async () => {
    const session = await startedSession();
    const { request, context } = toolRequest("get_round_context", { session });
    const body = await (await tool(request, context)).json();
    expect(body.round.sections).toHaveLength(3);
    expect(body.round.case.options).toHaveLength(3);
    expect(body.checkpoint).toMatchObject({
      stage: "briefing",
      alreadyGraded: false,
    });
    expect(body.learner.name).toBe("Dr. Patel");
    const serialized = JSON.stringify(body).toLowerCase();
    expect(serialized).not.toContain("correct");
    expect(serialized).not.toContain("answerkey");
  });

  it("grades on the server, repeats the same grade, and awards XP once", async () => {
    const session = await startedSession();
    const send = async (name: string, body: Record<string, unknown> = {}) => {
      const { request, context } = toolRequest(name, { session, ...body });
      const response = await tool(request, context);
      return { status: response.status, body: await response.json() };
    };
    const unclear = await send("submit_answer", { answer: "maybe B or C" });
    expect(unclear.body.verdict).toBe("clarify");
    const tooEarly = await send("complete_round");
    expect(tooEarly.status).toBe(409);
    const graded = await send("submit_answer", { answer: "B" });
    expect(graded.body).toMatchObject({ verdict: "correct", answerId: "B" });
    const repeat = await send("submit_answer", { answer: "A" });
    expect(repeat.body).toMatchObject({
      verdict: "correct",
      alreadyGraded: true,
    });
    const done = await send("complete_round");
    expect(done.body).toMatchObject({ xpTotal: 120, firstCompletion: true });
    expect(done.body.review.date).toBeTruthy();
    const again = await send("complete_round");
    expect(again.body).toMatchObject({ xpTotal: 120, firstCompletion: false });
    const progress = await withProgress(state.profile, (data) => data);
    expect(progress.attempts).toHaveLength(1);
    expect(progress.completions).toHaveLength(1);
  });

  it("reads an option out of spoken sentences but keeps ambiguity unclear", async () => {
    const option = (answer: string) => spokenOption(answer);
    expect(option("I'd go with B")).toBe("B");
    expect(option("B")).toBe("B");
    expect(option("it's B, diabetes wasn't required")).toBe("B");
    expect(option("I think the answer is C")).toBe("C");
    expect(option("option A")).toBe("A");
    expect(option("the second one")).toBe("B");
    expect(option("The trial included people with and without diabetes.")).toBe(
      "B",
    );
    // Anything that names two options, or none, goes to the server unchanged
    // so the learner is asked to clarify.
    expect(option("maybe B or C")).toBe("maybe B or C");
    expect(option("between the first and the second")).toBe(
      "between the first and the second",
    );
    const vague = "a trial like that probably applies to everyone";
    expect(option(vague)).toBe(vague);
  });

  it("serves the shift briefing in speech-ready form, with nothing to misread", async () => {
    const session = await startedSession();
    const { request, context } = toolRequest("get_shift_briefing", { session });
    const response = await tool(request, context);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.clinician.sayThisName).toBe("Dr. Zabish");
    expect(body.simulated).toBe(true);
    // A named patient in a room, not a record number.
    expect(body.briefing.urgent.patient).toMatch(/^(Mr|Ms)\. [A-Z]/);
    expect(body.briefing.urgent.room).toMatch(/[a-z]/);
    expect(body.briefing.urgent.requestedBy).toBeTruthy();
    expect(
      body.briefing.primaryCase.currentVitals.bloodPressure.spoken,
    ).toMatch(/ over /);
    expect(body.briefing.primaryCase.currentVitals.heartRate.spoken).toMatch(
      /beats per minute$/,
    );
    const serialized = JSON.stringify(body);
    // Nothing the voice could read as a URL, a record ID, or a raw timestamp.
    expect(serialized).not.toMatch(/https?:\/\//);
    expect(serialized).not.toMatch(/SYNTH-|scenario-|hospital-event|lab-/);
    expect(serialized).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(serialized).not.toContain("Â");
    // "Synthetic patient" language is gone from what gets spoken.
    expect(serialized.toLowerCase()).not.toContain("synthetic patient");
  });

  it("keeps one briefing for a whole call and varies between calls", async () => {
    const session = await startedSession();
    const read = async (s: string) => {
      const { request, context } = toolRequest("get_shift_briefing", {
        session: s,
      });
      return (await (await tool(request, context)).json()).briefing.urgent
        .fullName;
    };
    // Every tool call in one conversation describes the same patient.
    expect(await read(session)).toBe(await read(session));
    const patients = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const other = await createPhoneSession(
        state.profile,
        `1111111${i}-1111-4111-8111-11111111111${i % 10}`,
      );
      patients.add(await read(other));
    }
    expect(patients.size).toBeGreaterThan(1);
  });

  it("offers only topics that have a round behind them", async () => {
    const session = await startedSession();
    const { request, context } = toolRequest("get_topics", { session });
    const body = await (await tool(request, context)).json();
    expect(body.availableNow).toHaveLength(1);
    expect(body.availableNow[0]).toMatchObject({
      id: "heart-failure",
      minutes: 2,
    });
    expect(
      body.topics.filter((t: { available: boolean }) => !t.available),
    ).toHaveLength(3);
  });

  it("answers briefing questions even when no round is active", async () => {
    // A stale run must not break the briefing: it is the point of the call.
    const stale = await createPhoneSession(
      state.profile,
      "22222222-2222-4222-8222-222222222222",
    );
    const briefing = toolRequest("get_shift_briefing", { session: stale });
    expect((await tool(briefing.request, briefing.context)).status).toBe(200);
    const list = toolRequest("get_topics", { session: stale });
    expect((await tool(list.request, list.context)).status).toBe(200);
    // The lesson tools still require the current run.
    const lesson = toolRequest("get_round_context", { session: stale });
    expect((await tool(lesson.request, lesson.context)).status).toBe(409);
  });

  it("emails the front desk only with a confirmed, server-written message", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    const session = await startedSession();
    const send = async (body: Record<string, unknown>) => {
      const { request, context } = toolRequest("email_front_desk", {
        session,
        ...body,
      });
      const response = await tool(request, context);
      return { status: response.status, body: await response.json() };
    };
    // Unconfirmed, or missing words, never reaches the mail service.
    expect(
      (await send({ reason: "running_late", message: "20 minutes out" }))
        .status,
    ).toBe(400);
    expect(
      (await send({ reason: "running_late", confirmed: true })).status,
    ).toBe(400);
    const mail = vi.fn(async () => Response.json({ id: "email_1" }));
    vi.mocked(fetch).mockImplementation(mail);
    const ok = await send({
      reason: "running_late",
      message: "Held up in traffic, about twenty minutes out.",
      etaMinutes: 20,
      confirmed: true,
    });
    expect(ok.status).toBe(200);
    expect(ok.body.sent).toBe(true);
    // The address is masked in the reply, so it never reaches a transcript.
    expect(ok.body.to).not.toContain("kingzayzoom@gmail.com");
    const [, options] = mail.mock.calls[0] as unknown as [string, RequestInit];
    const sent = JSON.parse(options.body as string);
    expect(sent.to).toEqual(["kingzayzoom@gmail.com"]);
    expect(sent.subject).toBe("Dr. Zaybish — running late (Cardiac Step-Down)");
    // Reads as a note: greeting, the message, the ETA, one quiet footer.
    expect(sent.text).toMatch(/^Hi — Cortana here, on behalf of Dr. Zaybish\./);
    expect(sent.text).toContain(
      "Held up in traffic, about twenty minutes out.",
    );
    expect(sent.text).toContain("Expected in about 20 minutes.");
    expect(sent.text).toMatch(/demonstration message$/);
    expect(sent.text).not.toMatch(/Reason:|From:/);
  });

  it("refuses to send when the mail service is not configured", async () => {
    const session = await startedSession();
    const { request, context } = toolRequest("email_front_desk", {
      session,
      reason: "emergency",
      message: "Family emergency, cannot make rounds.",
      confirmed: true,
    });
    const response = await tool(request, context);
    expect(response.status).toBe(503);
    expect((await response.json()).error).toMatch(/not configured/);
  });

  it("rejects an unknown tool and a missing answer", async () => {
    const session = await startedSession();
    const unknown = toolRequest("delete_everything", { session });
    expect((await tool(unknown.request, unknown.context)).status).toBe(404);
    const noAnswer = toolRequest("submit_answer", { session });
    expect((await tool(noAnswer.request, noAnswer.context)).status).toBe(400);
  });
});
