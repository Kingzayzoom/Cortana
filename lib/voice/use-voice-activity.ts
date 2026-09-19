"use client"

import { useEffect, useRef, useState, type RefObject } from "react"

type Options = {
  active: boolean
  getInputVolume: () => number
  getOutputVolume: () => number
}

export type VoiceActivity = {
  /** Smoothed, noise-normalized energy in [0, 1], updated every frame without re-rendering. */
  inputEnergy: RefObject<number>
  outputEnergy: RefObject<number>
  /** Hysteresis-gated "the learner is talking" flag. Re-renders only on change. */
  userSpeaking: boolean
}

const HOLD_MS = 350

/**
 * Samples real microphone and assistant audio levels each animation frame.
 * An adaptive noise floor keeps "speaking" detection stable across mics and
 * rooms, and normalizes energy so the orb moves the same way everywhere.
 */
export function useVoiceActivity({ active, getInputVolume, getOutputVolume }: Options): VoiceActivity {
  const inputEnergy = useRef(0)
  const outputEnergy = useRef(0)
  const [userSpeaking, setUserSpeaking] = useState(false)

  useEffect(() => {
    if (!active) return

    let frame = 0
    // null forces the first frame to publish, clearing any stale flag from a previous session.
    let speaking: boolean | null = null
    let lastLoud = 0
    let floor = 0.05
    let peak = 0.3
    let smoothedIn = 0
    let smoothedOut = 0

    const tick = (now: number) => {
      const rawIn = clamp01(getInputVolume())
      const rawOut = clamp01(getOutputVolume())

      // Fast attack, slow release reads as "alive" without jitter.
      smoothedIn += (rawIn - smoothedIn) * (rawIn > smoothedIn ? 0.4 : 0.1)
      smoothedOut += (rawOut - smoothedOut) * (rawOut > smoothedOut ? 0.35 : 0.08)

      // Floor drops instantly and rises slowly; peak rises instantly and decays.
      floor = smoothedIn < floor ? smoothedIn : floor + (smoothedIn - floor) * 0.002
      peak = Math.max(smoothedIn, peak * 0.999, floor + 0.08)

      const range = peak - floor
      const energy = clamp01((smoothedIn - floor) / range)
      inputEnergy.current = energy
      outputEnergy.current = clamp01(smoothedOut * 2.2)

      const loud = smoothedIn > floor + Math.max(0.04, range * 0.35)
      if (loud) lastLoud = now
      const next = loud || (speaking === true && now - lastLoud < HOLD_MS)
      if (next !== speaking) {
        speaking = next
        setUserSpeaking(next)
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      inputEnergy.current = 0
      outputEnergy.current = 0
    }
  }, [active, getInputVolume, getOutputVolume])

  return { inputEnergy, outputEnergy, userSpeaking: active && userSpeaking }
}

function clamp01(n: number) {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0
}
