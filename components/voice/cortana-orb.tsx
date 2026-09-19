"use client"

import { useCallback, useEffect, useRef, type RefObject } from "react"
import dynamic from "next/dynamic"

import { cn } from "@/lib/utils"
import type { ConnectionState, VoiceState } from "@/lib/voice/state"

// three.js needs the browser; render a soft placeholder until it loads.
const Orb = dynamic(() => import("@/components/ui/orb").then((m) => m.Orb), {
  ssr: false,
  loading: () => <div className="size-full rounded-full bg-gradient-to-br from-[#C9D6FF] to-[#E4DAFF] opacity-70" />,
})

// Idle: blue / lavender. Learner speaking: cyan. Assistant speaking: blue / lavender.
const PALETTES = {
  idle: ["#8FA8FF", "#DCD2FF"],
  quiet: ["#7C98FF", "#CFC4FF"],
  "user-speaking": ["#1FB8E6", "#A8F0FF"],
  "assistant-speaking": ["#5877FF", "#BBA8FF"],
  "awaiting-response": ["#8C7BFF", "#D8CEFF"],
} satisfies Record<VoiceState | "idle", [string, string]>

type Props = {
  connection: ConnectionState
  voice: VoiceState
  inputEnergy: RefObject<number>
  outputEnergy: RefObject<number>
  className?: string
}

/**
 * The official ElevenLabs Orb, driven by real microphone and assistant output
 * levels while connected — never a canned animation.
 */
export function CortanaOrb({ connection, voice, inputEnergy, outputEnergy, className }: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const live = connection === "connected" || connection === "disconnecting"

  // Scale and halo follow the louder of the two channels, written straight to
  // a CSS variable so audio never triggers React renders.
  useEffect(() => {
    const el = stageRef.current
    if (!el || !live) return
    let frame = 0
    const tick = () => {
      el.style.setProperty("--orb-energy", Math.max(inputEnergy.current, outputEnergy.current * 0.8).toFixed(3))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      el.style.setProperty("--orb-energy", "0")
    }
  }, [live, inputEnergy, outputEnergy])

  const getInput = useCallback(() => inputEnergy.current, [inputEnergy])
  // A small baseline keeps the internal flow gently moving between turns.
  const getOutput = useCallback(() => Math.max(0.12, outputEnergy.current), [outputEnergy])

  const palette = live ? PALETTES[voice] : connection === "connecting" ? PALETTES["awaiting-response"] : PALETTES.idle

  return (
    <div
      ref={stageRef}
      className={cn("orb-stage aspect-square", className)}
      data-voice={live ? voice : "idle"}
      data-connection={connection}
      aria-hidden="true"
    >
      <div className="orb-halo" />
      <Orb
        className="relative size-full"
        colors={palette}
        seed={7}
        volumeMode={live ? "manual" : "auto"}
        agentState={connection === "connecting" ? "thinking" : null}
        getInputVolume={getInput}
        getOutputVolume={getOutput}
      />
    </div>
  )
}
