"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Grade, Message, Snapshot } from "./types";
import { sourceById } from "../content/round";
import type { Observation } from "../learning-signals/types";
type Result = Snapshot & {
  grade?: Grade;
  answer?: string;
  sourceIds?: string[];
  supported?: boolean;
};
type LearningContextValue = {
  data: Snapshot | null;
  error: string | null;
  busy: boolean;
  evidence: string | null;
  messages: Message[];
  act: (body: Record<string, unknown>) => Promise<Result>;
  observe: (observation: Observation, eventId?: string, runId?: string) => void;
  refresh: () => Promise<void>;
  openEvidence: (id: string | null) => boolean;
  addMessage: (message: Message) => void;
  clearMessages: () => void;
  clearError: () => void;
};
const LearningContext = createContext<LearningContextValue | null>(null);
export function LearningProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Snapshot | null>(null),
    [error, setError] = useState<string | null>(null);
  const [busyCount, setBusyCount] = useState(0),
    [evidence, setEvidence] = useState<string | null>(null),
    [messages, setMessages] = useState<Message[]>([]);
  const requestSeq = useRef(0);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const dataRef = useRef(data);
  const evidenceRef = useRef<string | null>(null);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/bootstrap", { cache: "no-store" });
      if (!response.ok)
        throw new Error("Your workspace couldn’t load. Please retry.");
      setData(await response.json());
      setError(null);
    } catch (error) {
      setError((error as Error).message);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const act = useCallback(
    async (body: Record<string, unknown>): Promise<Result> => {
      const seq = ++requestSeq.current;
      setBusyCount((n) => n + 1);
      setError(null);
      try {
        const pending = saveQueue.current
          .catch(() => {})
          .then(() =>
            fetch("/api/learning", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
              signal: AbortSignal.timeout(15_000),
            }),
          );
        saveQueue.current = pending;
        const response = await pending;
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error || "The action couldn’t be saved. Please try again.",
          );
        if (seq === requestSeq.current) setData(result);
        return result;
      } catch (error) {
        const message =
          error instanceof Error && error.name === "TimeoutError"
            ? "Saving timed out. Please retry; duplicate rewards are prevented."
            : (error as Error).message;
        setError(message);
        throw new Error(message);
      } finally {
        setBusyCount((n) => n - 1);
      }
    },
    [],
  );
  const observe = useCallback(
    (
      observation: Observation,
      eventId = crypto.randomUUID(),
      runId = dataRef.current?.run?.id,
    ) => {
      if (!runId) return;
      void act({ action: "observe", runId, eventId, observation }).catch(
        () => {},
      );
    },
    [act],
  );
  const openEvidence = useCallback(
    (id: string | null) => {
      if (id && !sourceById(id)) {
        setError("That source is not in this round’s evidence library.");
        return false;
      }
      if (evidenceRef.current !== id && id) {
        observe({
          type: "evidence_viewed",
          sourceId: id as "dapa-hf" | "dapa-diabetes",
        });
      }
      evidenceRef.current = id;
      setEvidence(id);
      return true;
    },
    [observe],
  );
  const addMessage = useCallback(
    (message: Message) =>
      setMessages((current) => {
        const index = current.findIndex((m) => m.id === message.id);
        if (index >= 0)
          return current.map((m) => (m.id === message.id ? message : m));
        return [...current, message].slice(-100);
      }),
    [],
  );
  return (
    <LearningContext.Provider
      value={{
        data,
        error,
        busy: busyCount > 0,
        evidence,
        messages,
        act,
        observe,
        refresh,
        openEvidence,
        addMessage,
        clearMessages: () => setMessages([]),
        clearError: () => setError(null),
      }}
    >
      {children}
    </LearningContext.Provider>
  );
}
export function useLearning() {
  const value = useContext(LearningContext);
  if (!value) throw new Error("LearningProvider is missing");
  return value;
}
