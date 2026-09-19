"use client";
import { useCallback, useState } from "react";
import { OrbVisual } from "./CortanaOrb";
import Link from "next/link";
const signals = {
  Silence: [0, 0],
  "Soft input": [0.15, 0],
  "Strong input": [0.9, 0],
  "Assistant output": [0, 0.85],
} as const;
export function OrbHarness() {
  const [signal, setSignal] = useState<keyof typeof signals>("Silence"),
    [muted, setMuted] = useState(false),
    [reduced, setReduced] = useState(false),
    [fallback, setFallback] = useState(false),
    [mounted, setMounted] = useState(true);
  const getInput = useCallback(() => signals[signal][0], [signal]);
  const getOutput = useCallback(() => signals[signal][1], [signal]);
  return (
    <main className="orb-harness">
      <Link href="/" className="text-button">
        ← Return to Cortana
      </Link>
      <h1>Orb development harness</h1>
      <p>
        SYNTHETIC TEST SIGNALS · No microphone or provider connection. This
        screen is unavailable in production.
      </p>
      {mounted ? (
        <OrbVisual
          getInput={getInput}
          getOutput={getOutput}
          connected
          muted={muted}
          reducedMotion={reduced}
          listening={signals[signal][0] > 0}
          fallback={fallback}
        />
      ) : (
        <div className="orb-stage centered">Renderer unmounted.</div>
      )}
      <div className="harness-signals">
        {Object.keys(signals).map((name) => (
          <button
            className="button button-secondary"
            aria-pressed={signal === name}
            onClick={() => setSignal(name as keyof typeof signals)}
            key={name}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="harness-options">
        <label>
          <input
            type="checkbox"
            checked={muted}
            onChange={(e) => setMuted(e.target.checked)}
          />
          Mute input
        </label>
        <label>
          <input
            type="checkbox"
            checked={reduced}
            onChange={(e) => setReduced(e.target.checked)}
          />
          Reduced motion
        </label>
        <label>
          <input
            type="checkbox"
            checked={fallback}
            onChange={(e) => setFallback(e.target.checked)}
          />
          Force fallback
        </label>
        <label>
          <input
            type="checkbox"
            checked={mounted}
            onChange={(e) => setMounted(e.target.checked)}
          />
          Mount renderer
        </label>
      </div>
      <p>
        Input {signals[signal][0]} · Output {signals[signal][1]} · Test adapter
        uses the same attack, release, clamp, and mute path as live audio.
      </p>
    </main>
  );
}
