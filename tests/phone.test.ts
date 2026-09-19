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

  it("explains a Twilio trial rejection without leaking the provider response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json(
        { detail: "The number is unverified on this trial account (secret)" },
        { status: 400 },
      ),
    );
    const response = await call(callRequest());
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toMatch(/trial account/);
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

  it("rejects an unknown tool and a missing answer", async () => {
    const session = await startedSession();
    const unknown = toolRequest("delete_everything", { session });
    expect((await tool(unknown.request, unknown.context)).status).toBe(404);
    const noAnswer = toolRequest("submit_answer", { session });
    expect((await tool(noAnswer.request, noAnswer.context)).status).toBe(400);
  });
});
