"use client";
// Client copy of today's Prime set.
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useLearning } from "../learning/provider";
import type { PrimeView } from "./types";
type Value = {
  data: PrimeView | null;
  busy: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  act: (input: Record<string, unknown>) => Promise<PrimeView>;
};
const Context = createContext<Value | null>(null);
export function PrimeProvider({ children }: { children: ReactNode }) {
  const learning = useLearning(),
    ready = Boolean(learning.data);
  const [data, setData] = useState<PrimeView | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!ready) return;
    try {
      const response = await fetch("/api/prime", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setData(result);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [ready]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const update = () => void refresh();
    window.addEventListener("prime-updated", update);
    window.addEventListener("focus", update);
    return () => {
      window.removeEventListener("prime-updated", update);
      window.removeEventListener("focus", update);
    };
  }, [refresh]);
  const act = async (input: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/prime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setData(result);
      void learning.refresh();
      return result as PrimeView;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  };
  return (
    <Context.Provider value={{ data, busy, error, refresh, act }}>
      {children}
    </Context.Provider>
  );
}
export function usePrime() {
  const v = useContext(Context);
  if (!v) throw Error("PrimeProvider missing");
  return v;
}
