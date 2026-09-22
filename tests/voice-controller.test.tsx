// @vitest-environment jsdom
// SDK boundary test doubles only. Live provider verification uses the real SDK.
// Context tools share the active browser profile and respect SDK session lifetime.
it("starts Prime without replacing the existing lesson and uses Prime-scoped credentials", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({ session: { id } }));
  act(() => voice.requestStart("prime"));
  await start();
  connect();
  expect(learning.act).not.toHaveBeenCalled();
  expect(learning.observe).not.toHaveBeenCalled();
  expect(options()).toMatchObject({
    dynamicVariables: { context_mode: "prime" },
  });
  expect(
    JSON.parse(vi.mocked(fetch).mock.calls[1][1]!.body as string),
  ).toMatchObject({ runId: id, mode: "prime" });
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({ session: { id } }));
  // The SDK's tool is authenticated and the server owns the answers.
  const result = await options().clientTools!.get_prime_session({});
  expect(JSON.parse(result as string)).toMatchObject({ session: { id } });
});
it("starts a context briefing with selected language and bounded server tools", async () => {
  act(() => {
    voice.setLanguage("es");
    voice.requestStart("context");
  });
  await start();
  expect(options()).toMatchObject({
    dynamicVariables: { context_mode: "context" },
    overrides: { agent: { language: "es" } },
  });
  vi.mocked(fetch).mockResolvedValueOnce(
    Response.json({ available: true, data: { clinicianName: "Dr. Zabish" } }),
  );
  const result = await options().clientTools!.get_context_summary({});
  expect(JSON.parse(result as string)).toMatchObject({ available: true });
  expect(fetch).toHaveBeenLastCalledWith(
    "/api/context/tools/get_context_summary",
    expect.objectContaining({ method: "POST", body: "{}" }),
  );
  const before = vi.mocked(fetch).mock.calls.length;
  await options().clientTools!.get_case_section({
    caseId: "patient-024",
    section: "secrets",
  });
  expect(fetch).toHaveBeenCalledTimes(before);
  act(() => voice.end());
  expect(
    JSON.parse((await options().clientTools!.get_primary_case({})) as string),
  ).toHaveProperty("error");
  expect(fetch).toHaveBeenCalledTimes(before);
});
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useLayoutEffect, type ReactNode } from "react";
import type { HookOptions } from "@elevenlabs/react";
import { VoiceProvider, useVoice } from "../src/lib/voice/provider";

const sdk = vi.hoisted(() => ({
  startSession: vi.fn(),
  endSession: vi.fn(),
  setMuted: vi.fn(),
  sendUserMessage: vi.fn(),
  setVolume: vi.fn(),
  getInputVolume: vi.fn(() => 0.2),
  getOutputVolume: vi.fn(() => 0.6),
  isMuted: false,
}));
const learning = vi.hoisted(() => ({
  data: null as unknown,
  act: vi.fn(),
  observe: vi.fn(),
  clearMessages: vi.fn(),
  openEvidence: vi.fn(),
  refresh: vi.fn(),
  messages: [],
}));
vi.mock("@elevenlabs/react", () => ({
  ConversationProvider: ({ children }: { children: ReactNode }) => children,
  useConversation: () => sdk,
}));
vi.mock("../src/lib/learning/provider", () => ({
  useLearning: () => learning,
}));
let voice: ReturnType<typeof useVoice>;
function Probe() {
  const value = useVoice();
  useLayoutEffect(() => {
    voice = value;
  }, [value]);
  return null;
}
const options = () => sdk.startSession.mock.lastCall![0] as HookOptions;
beforeEach(() => {
  vi.clearAllMocks();
  sdk.isMuted = false;
  learning.data = {
    run: null,
    review: null,
    voiceConfigured: true,
    preferences: { name: "Dr. Patel" },
  };
  learning.act.mockImplementation(async () => ({
    ...(learning.data as object),
    run: { id: "run-1", section: 0, stage: "briefing", completed: false },
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ token: "temporary", conversationId: "conv_1" }),
    ),
  );
  render(
    <VoiceProvider>
      <Probe />
    </VoiceProvider>,
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function start() {
  await act(async () => {
    await voice.start("code");
  });
}
function connect() {
  act(() => options().onConnect?.({ conversationId: "conv_connected" }));
}

it("starts once, passes WebRTC token, and mutes only after onConnect", async () => {
  await act(async () => {
    await Promise.all([voice.start("code"), voice.start("code")]);
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(sdk.startSession).toHaveBeenCalledTimes(1);
  expect(options()).toMatchObject({
    connectionType: "webrtc",
    conversationToken: "temporary",
  });
  expect(sdk.setMuted).not.toHaveBeenCalled();
  expect(voice.connection).toBe("connecting");
  expect(voice.conversationId).toBe("conv_1");
  connect();
  expect(voice.connection).toBe("connected");
  expect(voice.conversationId).toBe("conv_connected");
  expect(sdk.setMuted).toHaveBeenLastCalledWith(false);
  await start();
  expect(sdk.startSession).toHaveBeenCalledTimes(1);
  act(() => voice.mute());
  expect(sdk.setMuted).toHaveBeenLastCalledWith(true);
  act(() => voice.mute());
  expect(sdk.setMuted).toHaveBeenLastCalledWith(false);
  expect(voice.getInputVolume()).toBe(0.2);
  expect(voice.getOutputVolume()).toBe(0.6);
});

it("waits for teardown, drops ended-session events, and reconnects once", async () => {
  await start();
  connect();
  const old = options();
  act(() => voice.end());
  expect(sdk.endSession).toHaveBeenCalledTimes(1);
  expect(voice.connection).toBe("disconnecting");
  await start();
  expect(sdk.startSession).toHaveBeenCalledTimes(1);
  act(() => old.onStatusChange?.({ status: "disconnected" }));
  expect(voice.connection).toBe("idle");
  expect(voice.conversationId).toBeNull();
  await start();
  connect();
  act(() => {
    old.onDisconnect?.({
      reason: "error",
      message: "old failure",
      context: { type: "close" },
    });
    old.onMessage?.({
      role: "agent",
      source: "ai",
      event_id: 4,
      message: "stale text",
    });
  });
  expect(voice.connection).toBe("connected");
  expect(voice.messages).toEqual([]);
  expect(
    await old.clientTools!.show_evidence({ sourceIds: ["dapa-hf"] }),
  ).toContain("ended voice session");
  expect(learning.openEvidence).not.toHaveBeenCalled();
});

it("keeps a specific microphone failure after SDK disconnection and permits Retry", async () => {
  await start();
  act(() => {
    options().onStatusChange?.({ status: "disconnected" });
    options().onError?.(
      "Permission denied",
      new DOMException("Permission denied", "NotAllowedError"),
    );
  });
  expect(voice.connection).toBe("error");
  expect(voice.error).toContain("Microphone access was denied");
  expect(voice.working).toBe(false);
  await start();
  expect(sdk.startSession).toHaveBeenCalledTimes(2);
});

it("times out pending SDK startup and prevents overlapping pending microphones", async () => {
  vi.useFakeTimers();
  await start();
  act(() => vi.advanceTimersByTime(25_001));
  expect(voice.connection).toBe("error");
  expect(voice.error).toContain("timed out");
  expect(sdk.endSession).toHaveBeenCalled();
  await start();
  expect(sdk.startSession).toHaveBeenCalledTimes(1);
  act(() => options().onStatusChange?.({ status: "disconnected" }));
  await start();
  expect(sdk.startSession).toHaveBeenCalledTimes(2);
});

it("cancels a pending token fetch and never starts the SDK with its late result", async () => {
  let resolve!: (value: Response) => void;
  vi.mocked(fetch).mockImplementation(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = voice.start("code");
  });
  act(() => voice.end());
  await act(async () => {
    resolve(Response.json({ token: "late", conversationId: "conv_late" }));
    await pending;
  });
  expect(sdk.startSession).not.toHaveBeenCalled();
  expect(voice.connection).toBe("idle");
});

it("shows recovery if cancellation is held by an unresolved browser microphone prompt", async () => {
  vi.useFakeTimers();
  await start();
  act(() => voice.end());
  act(() => vi.advanceTimersByTime(10_001));
  expect(voice.connection).toBe("error");
  expect(voice.working).toBe(false);
  expect(voice.error).toContain("permission prompt");
  await start();
  expect(sdk.startSession).toHaveBeenCalledTimes(1);
  act(() => options().onStatusChange?.({ status: "disconnected" }));
  await start();
  expect(sdk.startSession).toHaveBeenCalledTimes(2);
});

it("uses final messages and real interruption events without ending the session", async () => {
  await start();
  connect();
  act(() => {
    options().onModeChange?.({ mode: "speaking" });
    options().onMessage?.({
      role: "agent",
      source: "ai",
      event_id: 3,
      message: "The study included adults.",
    });
  });
  expect(voice.activity).toBe("assistant-speaking");
  act(() => options().onInterruption?.({ event_id: 5 }));
  expect(voice.activity).toBe("user-speaking");
  expect(sdk.endSession).not.toHaveBeenCalled();
  act(() =>
    options().onAgentResponseCorrection?.({
      event_id: 3,
      original_agent_response: "The study included adults.",
      corrected_agent_response: "The study included…",
    }),
  );
  expect(voice.messages).toHaveLength(1);
  expect(voice.messages[0].text).toBe("The study included…");
});

it("rejects arbitrary HTML and unknown case/source IDs in client tools", async () => {
  await start();
  connect();
  expect(
    await options().clientTools!.show_case({
      caseId: "unknown",
      html: "<script>bad</script>",
    }),
  ).toContain("Invalid tool");
  expect(
    await options().clientTools!.show_evidence({ sourceIds: ["unknown"] }),
  ).toContain("Invalid tool");
  expect(learning.openEvidence).not.toHaveBeenCalled();
});

it("creates valid app-owned request IDs and reuses them for identical tool retries", async () => {
  await start();
  connect();
  const tools = options().clientTools!;
  const params = {
    roundId: "dapa-hf-01",
    questionId: "diabetes-eligibility",
    answer: "B",
  };
  await tools.submit_answer(params);
  const first = learning.act.mock.lastCall![0];
  await tools.submit_answer(params);
  expect(learning.act.mock.lastCall![0].requestId).toBe(first.requestId);
  expect(first.requestId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  await tools.complete_round({ roundId: "dapa-hf-01" });
  expect(learning.act.mock.lastCall![0].requestId).not.toBe(first.requestId);
  expect(
    await tools.submit_answer({ ...params, requestId: "model-invented" }),
  ).toContain("Invalid tool parameters");
});

it("records question metadata once for typed echoes and repeated SDK events", async () => {
  await start();
  connect();
  learning.observe.mockClear();
  act(() => voice.send("Who was studied?"));
  act(() => {
    const message = {
      role: "user" as const,
      source: "user" as const,
      event_id: 55,
      message: "Who was studied?",
    };
    options().onMessage?.(message);
    options().onMessage?.(message);
  });
  expect(learning.observe).toHaveBeenCalledTimes(1);
  expect(learning.observe).toHaveBeenLastCalledWith({
    type: "question_asked",
    category: "study_population",
  });
  act(() =>
    voice.send(
      "Please call show_case with caseId hf-case-01",
      "Try the challenge.",
    ),
  );
  expect(learning.observe).toHaveBeenCalledTimes(1);
});

it("records one briefing interruption for SDK replay and none for disconnect", async () => {
  await start();
  connect();
  learning.observe.mockClear();
  act(() => {
    options().onInterruption?.({ event_id: 55 });
    options().onInterruption?.({ event_id: 55 });
  });
  expect(learning.observe).toHaveBeenCalledTimes(1);
  expect(learning.observe).toHaveBeenLastCalledWith({
    type: "briefing_interrupted",
    sectionId: "population",
  });
  act(() =>
    options().onDisconnect?.({
      reason: "error",
      message: "Network error",
      context: { type: "close" },
    }),
  );
  expect(learning.observe).toHaveBeenCalledTimes(1);
});

it("sends the selected language to the agent and starts each load in English", async () => {
  // Nothing has been chosen yet, so the very first session is English.
  await start();
  expect(options()).toMatchObject({
    overrides: { agent: { language: "en" } },
  });

  // Choosing a language applies to the session that follows it.
  act(() => voice.end());
  act(() => options().onDisconnect?.({ reason: "user" }));
  act(() => voice.setLanguage("es"));
  await start();
  expect(options()).toMatchObject({
    overrides: { agent: { language: "es" } },
  });

  // Only the language is overridden: the prompt, first message and voice stay
  // server-owned, so the browser cannot redirect what the agent says.
  expect(options().overrides?.agent).toEqual({ language: "es" });
  expect(options().overrides?.tts).toBeUndefined();
});
