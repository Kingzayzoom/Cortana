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
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/bootstrap", { cache: "no-store" });
      if (!response.ok) {
        // Server messages are written to be safe to show, and name the cause.
        const reason = await response
          .json()
          .then((body) => body?.error as string | undefined)
          .catch(() => undefined);
        throw new Error(
          `Your workspace couldn’t load. ${reason ?? "Please retry."}`,
        );
      }
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
        const response = await fetch("/api/learning", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15_000),
        });
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
  const openEvidence = useCallback((id: string | null) => {
    if (id && !sourceById(id)) {
      setError("That source is not in this round’s evidence library.");
      return false;
    }
    setEvidence(id);
    return true;
  }, []);
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
