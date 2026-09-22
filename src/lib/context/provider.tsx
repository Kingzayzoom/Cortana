"use client";
// Client copy of the profile's active Context Feed scenario.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useLearning } from "../learning/provider";
import { normalizeScenario } from "./normalize";
import * as selectors from "./selectors";
import type { ContextScenario } from "./types";
type Value = {
  activeScenario: ContextScenario | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  phoneConfigured: boolean;
  setActiveScenario: (scenario: ContextScenario) => Promise<void>;
  clearScenario: () => Promise<void>;
  refresh: () => Promise<void>;
  getPrimaryCase: () => ReturnType<typeof selectors.getPrimaryCase>;
  getRecentChanges: () => ReturnType<typeof selectors.getRecentChanges>;
  getTimeline: () => ReturnType<typeof selectors.getTimeline>;
  getScheduledEvents: () => ReturnType<typeof selectors.getScheduledEvents>;
  getEducationTriggers: () => ReturnType<typeof selectors.getEducationTriggers>;
};
const Context = createContext<Value | null>(null);
export function ContextProvider({ children }: { children: ReactNode }) {
  const { data } = useLearning();
  const [activeScenario, setActive] = useState<ContextScenario | null>(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null),
    [phoneConfigured, setPhoneConfigured] = useState(false);
  const ready = Boolean(data);
  const refresh = useCallback(async () => {
    if (!ready) return;
    try {
      const response = await fetch("/api/context", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setActive(
        result.activeScenario ? normalizeScenario(result.activeScenario) : null,
      );
      setPhoneConfigured(Boolean(result.phoneConfigured));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Context could not load.");
    } finally {
      setLoading(false);
    }
  }, [ready]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const listener = () => void refresh();
    window.addEventListener("focus", listener);
    return () => window.removeEventListener("focus", listener);
  }, [refresh]);
  const save = async (scenario: ContextScenario | null) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/context", {
        method: scenario ? "PUT" : "DELETE",
        headers: { "Content-Type": "application/json" },
        ...(scenario ? { body: JSON.stringify(scenario) } : {}),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error +
            (result.issues
              ? " " +
                result.issues
                  .map(
                    (i: { path: string; message: string }) =>
                      i.path + ": " + i.message,
                  )
                  .join("; ")
              : ""),
        );
      setActive(
        result.activeScenario ? normalizeScenario(result.activeScenario) : null,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Context could not save.");
      throw e;
    } finally {
      setBusy(false);
    }
  };
  return (
    <Context.Provider
      value={{
        activeScenario,
        loading,
        busy,
        error,
        phoneConfigured,
        setActiveScenario: save,
        clearScenario: () => save(null),
        refresh,
        getPrimaryCase: () => selectors.getPrimaryCase(activeScenario),
        getRecentChanges: () => selectors.getRecentChanges(activeScenario),
        getTimeline: () => selectors.getTimeline(activeScenario),
        getScheduledEvents: () => selectors.getScheduledEvents(activeScenario),
        getEducationTriggers: () =>
          selectors.getEducationTriggers(activeScenario),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useContextScenario() {
  const value = useContext(Context);
  if (!value) throw new Error("ContextProvider is missing");
  return value;
}
