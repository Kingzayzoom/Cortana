"use client";
/* eslint-disable react-hooks/refs -- The tool factory returns callbacks; their ref reads occur only when ElevenLabs invokes a tool, never during render. */
import {
  ConversationProvider,
  useConversation,
  type ClientTools,
} from "@elevenlabs/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { z } from "zod";
import { useLearning } from "../learning/provider";
import type {
  ConnectionState,
  VoiceActivity,
  Message,
} from "../learning/types";
import { voiceErrorMessage } from "./errors";
import { VoiceTranscript } from "./transcript";
import { contextToolNames, contextToolSchemas } from "../context/tools";
import {
  clientAnswerTool,
  caseTool,
  clientCompletionTool,
  contextTool,
  evidenceTool,
  stageTool,
} from "../validation/contracts";
import { round, sources } from "../content/round";
import {
  DEFAULT_LANGUAGE,
  type SpokenLanguage,
} from "./languages";
import { classifyQuestion, isQuestion } from "../learning-signals/adapter";
type VoiceValue = {
  connection: ConnectionState;
  activity: VoiceActivity;
  muted: boolean;
  paused: boolean;
  /** Spoken language for the next session. Never persisted: English each load. */
  language: SpokenLanguage;
  setLanguage: (language: SpokenLanguage) => void;
  preview: boolean;
  consentOpen: boolean;
  error: string | null;
  working: boolean;
  conversationId: string | null;
  messages: Message[];
  briefing: boolean;
  requestStart: (mode?: "round" | "context") => void;
  closeConsent: () => void;
  start: (code: string) => Promise<void>;
  startPreview: () => Promise<void>;
  end: () => void;
  pause: () => void;
  mute: () => void;
  send: (text: string, transcriptText?: string, intent?: "question") => void;
  setOutputVolume: (volume: number) => void;
  getInputVolume: () => number;
  getOutputVolume: () => number;
};
const VoiceContext = createContext<VoiceValue | null>(null);
export function VoiceProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConversationProvider>
      <VoiceController>{children}</VoiceController>
    </ConversationProvider>
  );
}
function VoiceController({ children }: { children: React.ReactNode }) {
  const learning = useLearning();
  const [briefing, setBriefing] = useState(false);
  const briefingRef = useRef(false);
  const [connection, setConnection] = useState<ConnectionState>("idle"),
    [activity, setActivity] = useState<VoiceActivity>("quiet");
  const [language, setLanguage] = useState<SpokenLanguage>(DEFAULT_LANGUAGE);
  const languageRef = useRef<SpokenLanguage>(DEFAULT_LANGUAGE);
  const [paused, setPaused] = useState(false),
    [preview, setPreview] = useState(false),
    [consentOpen, setConsentOpen] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const transcript = useRef<VoiceTranscript | null>(null);
  const abort = useRef<AbortController | null>(null);
  const sdkStarted = useRef(false);
  const sdkDisconnected = useRef(true);
  const stopReason = useRef<"end" | "error" | null>(null);
  const lock = useRef(false),
    generation = useRef(0),
    accepting = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restored = useRef(false);
  const current = useRef(learning);
  const mutedRef = useRef(false);
  const speakingRef = useRef(false);
  const observedMessages = useRef(new Set<string>());
  const recordQuestions = (rows: Message[]) => {
    for (const row of rows) {
      if (row.role !== "user" || observedMessages.current.has(row.id)) continue;
      observedMessages.current.add(row.id);
      if (isQuestion(row.text))
        current.current.observe({
          type: "question_asked",
          category: classifyQuestion(row.text),
        });
    }
  };
  useEffect(() => {
    current.current = learning;
  }, [learning]);
  useEffect(() => {
    if (!learning.data || restored.current) return;
    restored.current = true;
    if (learning.data.run && !learning.data.run.completed) {
      setPaused(true);
      setPreview(true);
    }
  }, [learning.data]);
  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const clientTools: ClientTools = useMemo(() => {
    const requestIds = new Map<string, string>();
    const requestId = (operation: string, runId: string, params: unknown) => {
      const key = JSON.stringify([operation, runId, params]);
      if (!requestIds.has(key)) {
        if (requestIds.size >= 100)
          requestIds.delete(requestIds.keys().next().value!);
        requestIds.set(key, crypto.randomUUID());
      }
      return requestIds.get(key)!;
    };
    const tool =
      <T,>(
        schema: z.ZodType<T>,
        operation: (params: T, runId: string) => Promise<unknown> | unknown,
      ) =>
      async (params: Record<string, unknown>) => {
        const parsed = schema.safeParse(params);
        if (!parsed.success)
          return JSON.stringify({
            error: "Invalid tool parameters or unknown content ID.",
          });
        const runId = current.current.data?.run?.id;
        if (!accepting.current || !runId)
          return JSON.stringify({
            error: "The voice session is no longer active.",
          });
        try {
          return JSON.stringify(await operation(parsed.data, runId));
        } catch (error) {
          return JSON.stringify({ error: (error as Error).message });
        }
      };
    return {
      ...Object.fromEntries(contextToolNames.map((name) => [
        name,
        tool<unknown>(contextToolSchemas[name], async (params) => {
          const response = await fetch(`/api/context/tools/${name}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params), cache: "no-store",
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Context lookup failed.");
          return result;
        }),
      ])),
      get_round_context: tool(contextTool, () => ({
        conversationMode: briefingRef.current ? "context" : "round",
        round,
        sources,
        checkpoint: current.current.data?.run,
        instruction:
          "Read the current section. Use only the supplied source IDs. Call tools for stage changes and grading. Never infer a grade.",
      })),
      show_stage: tool(stageTool, (params, runId) =>
        current.current.act({ action: "stage", runId, ...params }),
      ),
      show_case: tool(caseTool, (_, runId) =>
        current.current.act({ action: "stage", runId, stageId: "challenge" }),
      ),
      show_evidence: tool(evidenceTool, (params) => {
        current.current.openEvidence(params.sourceIds[0]);
        return {
          sources: sources.filter((s) => params.sourceIds.includes(s.id)),
        };
      }),
      submit_answer: tool(clientAnswerTool, (params, runId) =>
        current.current.act({
          action: "answer",
          runId,
          ...params,
          requestId: requestId("answer", runId, params),
        }),
      ),
      complete_round: tool(clientCompletionTool, (params, runId) =>
        current.current.act({
          action: "complete",
          runId,
          ...params,
          requestId: requestId("complete", runId, params),
        }),
      ),
      get_next_review: tool(
        z.object({}).strict(),
        () =>
          current.current.data?.review ?? {
            reason: "Complete your first round to schedule a review.",
          },
      ),
    };
  }, []);
  // React SDK 1.15.2 returns void; callbacks own connection and teardown.
  const conversation = useConversation();
  const controlsRef = useRef(conversation);
  useEffect(() => {
    controlsRef.current = conversation;
    mutedRef.current = conversation.isMuted;
  }, [conversation]);
  const finish = () => {
    clearTimer();
    abort.current?.abort();
    abort.current = null;
    accepting.current = false;
    sdkStarted.current = false;
    sdkDisconnected.current = true;
    speakingRef.current = false;
    mutedRef.current = false;
    lock.current = false;
    generation.current++;
    setWorking(false);
    setActivity("quiet");
    setConversationId(null);
    setConnection(stopReason.current === "error" ? "error" : "idle");
  };
  useEffect(
    () => () => {
      generation.current++;
      accepting.current = false;
      abort.current?.abort();
      clearTimer();
      controlsRef.current.endSession();
    },
    [clearTimer],
  );

  const end = () => {
    stopReason.current = "end";
    accepting.current = false;
    abort.current?.abort();
    clearTimer();
    setConsentOpen(false);
    setPreview(false);
    setPaused(false);
    setError(null);
    setActivity("quiet");
    if (sdkStarted.current) {
      // Do not open another session while the SDK is releasing audio resources.
      setConnection("disconnecting");
      setWorking(true);
      timer.current = setTimeout(() => {
        stopReason.current = "error";
        setConnection("error");
        setWorking(false);
        setPaused(true);
        setError(
          "The microphone request has not finished closing. Resolve the browser permission prompt or reload this tab before reconnecting.",
        );
      }, 10_000);
      controlsRef.current.endSession();
    } else finish();
  };
  const pause = () => {
    // No native pause/resume API: this control is available only in text preview.
    if (!preview) return;
    setPaused(true);
    setActivity("quiet");
  };
  const startPreview = async () => {
    if (lock.current) return;
    lock.current = true;
    setWorking(true);
    try {
      setConnection("idle");
      setConversationId(null);
      setError(null);
      setConsentOpen(false);
      if (!paused || !learning.data?.run || learning.data.run.completed) {
        learning.clearMessages();
        await learning.act({ action: "begin" });
      } else learning.observe({ type: "round_started", mode: "preview" });
      setPreview(true);
      setPaused(false);
    } catch {
      // The learning provider displays save failures.
    } finally {
      lock.current = false;
      setWorking(false);
    }
  };
  const start = async (code: string) => {
    if (lock.current) {
      if (stopReason.current === "error")
        setError(
          "The previous microphone request is still closing. Resolve the browser permission prompt, then Retry.",
        );
      return;
    }
    lock.current = true;
    stopReason.current = null;
    sdkStarted.current = false;
    sdkDisconnected.current = true;
    setWorking(true);
    setError(null);
    setConnection("connecting");
    setConversationId(null);
    setPreview(false);
    setActivity("quiet");
    const sessionGeneration = ++generation.current;
    const isCurrent = () => generation.current === sessionGeneration;
    const isActive = () => isCurrent() && accepting.current;
    const requestAbort = new AbortController();
    abort.current = requestAbort;
    try {
      let data = learning.data;
      if (!paused || !data?.run || data.run.completed) {
        learning.clearMessages();
        data = await learning.act({ action: "begin", mode: "voice" });
      }
      if (!isCurrent()) return;
      current.current = { ...current.current, data };
      const response = await fetch("/api/elevenlabs/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessCode: code,
          consent: true,
          runId: data!.run!.id,
        }),
        cache: "no-store",
        signal: AbortSignal.any([
          requestAbort.signal,
          AbortSignal.timeout(15_000),
        ]),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const safe = z.object({ error: z.string().max(600) }).safeParse(result);
        throw new Error(
          safe.success
            ? safe.data.error
            : "The voice token request failed. Please Retry.",
        );
      }
      const credential = z
        .object({
          token: z.string().trim().min(1),
          conversationId: z.string().trim().min(1),
        })
        .safeParse(result);
      if (!credential.success)
        throw new Error(
          "The server returned an invalid voice credential. Please Retry.",
        );
      if (!isCurrent()) return;
      abort.current = null;
      accepting.current = true;
      sdkStarted.current = true;
      sdkDisconnected.current = false;
      setConversationId(credential.data.conversationId);
      transcript.current = new VoiceTranscript(credential.data.conversationId);
      observedMessages.current.clear();
      setMessages([]);
      setConsentOpen(false);
      setPaused(false);
      const fail = (message: string, context?: unknown) => {
        if (!isCurrent()) return;
        stopReason.current = "error";
        accepting.current = false;
        speakingRef.current = false;
        clearTimer();
        setWorking(false);
        setConnection("error");
        setActivity("quiet");
        setPaused(true);
        setError(voiceErrorMessage(message, context));
        controlsRef.current.endSession();
        if (sdkDisconnected.current) finish();
      };
      timer.current = setTimeout(() => fail("Connection timed out"), 25_000);
      const sessionTools = Object.fromEntries(
        Object.entries(clientTools).map(([name, handler]) => [
          name,
          (params: Record<string, unknown>) =>
            isActive()
              ? handler(params)
              : JSON.stringify({
                  error: "Event belongs to an ended voice session.",
                }),
        ]),
      );
      conversation.startSession({
        conversationToken: credential.data.token,
        connectionType: "webrtc",
        clientTools: sessionTools,
        dynamicVariables: {
          context_mode: briefingRef.current ? "context" : "round",
          round_id: round.id,
          section_id: round.sections[data!.run!.section].id,
          lesson_stage: data!.run!.stage,
        },
        // Language only. The prompt, voice and first message stay server-side,
        // so the browser cannot redirect what the agent says, only which
        // language it says it in. Requires the agent to allow the language
        // override and to list this language; otherwise it keeps its default.
        overrides: {
          agent: { language: languageRef.current },
        },
        onConnect: ({ conversationId: connectedId }) => {
          if (!isCurrent()) return;
          if (!accepting.current) {
            controlsRef.current.endSession();
            return;
          }
          clearTimer();
          setConversationId(connectedId);
          setWorking(false);
          setConnection("connected");
          current.current.observe(
            { type: "round_started", mode: "voice" },
            undefined,
            data!.run!.id,
          );
          setActivity("quiet");
          // setMuted throws before a conversation exists in this SDK version.
          controlsRef.current.setMuted(false);
        },
        onStatusChange: ({ status }) => {
          if (!isCurrent()) return;
          sdkDisconnected.current = status === "disconnected";
          if (status === "disconnected" && stopReason.current) finish();
          else if (
            status === "disconnecting" &&
            stopReason.current !== "error"
          ) {
            accepting.current = false;
            setConnection("disconnecting");
            setWorking(true);
            setActivity("quiet");
          }
        },
        onDisconnect: (details) => {
          if (!isCurrent()) return;
          if (details.reason === "error" && stopReason.current !== "end") {
            stopReason.current = "error";
            setError(
              voiceErrorMessage(
                details.message + " " + (details.context.reason ?? ""),
              ),
            );
            setPaused(true);
          } else if (!stopReason.current) setPaused(true);
          finish();
        },
        onError: (message, context) => fail(message, context),
        onModeChange: ({ mode }) => {
          if (!isActive()) return;
          speakingRef.current = mode === "speaking";
          setActivity(mode === "speaking" ? "assistant-speaking" : "quiet");
        },
        onVadScore: ({ vadScore }) => {
          if (isActive() && !mutedRef.current && !speakingRef.current)
            setActivity(vadScore > 0.45 ? "user-speaking" : "quiet");
        },
        onInterruption: (event) => {
          if (!isActive()) return;
          const run = current.current.data?.run;
          if (run?.stage === "briefing") {
            // Only SDK interruptions, never disconnects, produce this observation.
            const key = `interruption:${credential.data.conversationId}:${event.event_id}`;
            if (!observedMessages.current.has(key)) {
              observedMessages.current.add(key);
              current.current.observe({
                type: "briefing_interrupted",
                sectionId: round.sections[run.section].id as
                  "population" | "finding" | "limitation",
              });
            }
          }
          // ElevenLabs/LiveKit interrupt playback; this only reflects the event.
          speakingRef.current = false;
          setActivity(mutedRef.current ? "quiet" : "user-speaking");
        },
        onAgentToolRequest: () => {
          if (isActive() && !speakingRef.current)
            setActivity("awaiting-response");
        },
        onAgentToolResponse: () => {
          if (isActive() && !speakingRef.current) setActivity("quiet");
        },
        onUnhandledClientToolCall: () => {
          if (isActive())
            setError(
              "An agent tool is not configured in this app. Check the agent's Client tools and reconnect.",
            );
        },
        onMessage: (message) => {
          if (isActive() && transcript.current) {
            const rows = transcript.current.received(message);
            recordQuestions(rows);
            setMessages(rows);
          }
        },
        onAgentResponseCorrection: (correction) => {
          if (
            isActive() &&
            transcript.current &&
            typeof correction.corrected_agent_response === "string" &&
            correction.event_id !== undefined
          )
            setMessages(
              transcript.current.corrected(
                correction.event_id,
                correction.corrected_agent_response,
              ),
            );
        },
      });
    } catch (error) {
      if (!isCurrent()) return;
      stopReason.current = "error";
      accepting.current = false;
      setPaused(true);
      const message = error instanceof Error ? error.message : "";
      setError(
        error instanceof Error && error.name === "Error"
          ? message
          : voiceErrorMessage(message, error),
      );
      if (sdkStarted.current) controlsRef.current.endSession();
      finish();
    }
  };
  return (
    <VoiceContext.Provider
      value={{
        connection,
        activity,
        muted: conversation.isMuted,
        language,
        setLanguage: (next: SpokenLanguage) => {
          languageRef.current = next;
          setLanguage(next);
        },
        paused,
        preview,
        briefing,
        consentOpen,
        error,
        working,
        conversationId,
        messages: preview ? learning.messages : messages,
        requestStart: (mode = "round") => {
          briefingRef.current = mode === "context";
          setBriefing(mode === "context");
          if (!lock.current || stopReason.current === "error")
            setConsentOpen(true);
        },
        closeConsent: () => setConsentOpen(false),
        start,
        startPreview,
        end,
        pause,
        mute: () => {
          if (!accepting.current || connection !== "connected") return;
          const muted = !mutedRef.current;
          mutedRef.current = muted;
          conversation.setMuted(muted);
          if (muted && !speakingRef.current) setActivity("quiet");
        },
        send: (text, transcriptText, intent) => {
          if (
            accepting.current &&
            connection === "connected" &&
            transcript.current
          ) {
            conversation.sendUserMessage(text);
            const rows = transcript.current.sent(text, transcriptText);
            if (
              intent === "question" &&
              !/^(i am finished|(?:please )?(?:complete|finish|end|stop|continue|start|resume)\b)/i.test(
                text.trim(),
              )
            ) {
              const question = rows.at(-1)!;
              observedMessages.current.add(question.id);
              current.current.observe({
                type: "question_asked",
                category: classifyQuestion(text),
              });
            }
            // UI control instructions are not learner questions.
            if (transcriptText === undefined) recordQuestions(rows);
            else for (const row of rows) observedMessages.current.add(row.id);
            setMessages(rows);
            setActivity("awaiting-response");
          }
        },
        setOutputVolume: (volume) => {
          if (accepting.current && connection === "connected")
            conversation.setVolume({
              volume: Math.max(0, Math.min(1, volume)),
            });
        },
        getInputVolume: conversation.getInputVolume,
        getOutputVolume: conversation.getOutputVolume,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
}
export function useVoice() {
  const value = useContext(VoiceContext);
  if (!value) throw new Error("VoiceProvider is missing");
  return value;
}
