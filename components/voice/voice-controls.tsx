"use client"

import { Loader, Mic, MicOff, PhoneOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { VOICE_STATUS_TEXT, type ConnectionState, type VoiceState } from "@/lib/voice/state"

type Props = {
  connection: ConnectionState
  voice: VoiceState
  muted: boolean
  onToggleMute: () => void
  onEnd: () => void
}

export function VoiceStatus({ connection, voice, muted }: Pick<Props, "connection" | "voice" | "muted">) {
  const text =
    connection === "connecting"
      ? "Connecting…"
      : connection === "disconnecting"
        ? "Ending…"
        : connection === "connected"
          ? muted && voice !== "assistant-speaking"
            ? "Microphone muted"
            : VOICE_STATUS_TEXT[voice]
          : "Ready when you are"

  return (
    <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground" aria-live="polite">
      <span
        className={cn(
          "size-1.5 rounded-full bg-muted-foreground/40",
          connection === "connected" && "bg-success",
          voice === "user-speaking" && "bg-cyan",
          voice === "assistant-speaking" && "bg-primary",
          connection === "connecting" && "animate-pulse bg-lavender",
        )}
      />
      {text}
    </p>
  )
}

export function VoiceControls({ connection, muted, onToggleMute, onEnd }: Omit<Props, "voice">) {
  const busy = connection === "connecting" || connection === "disconnecting"
  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="outline"
        size="lg"
        className="rounded-full px-4"
        onClick={onToggleMute}
        disabled={connection !== "connected"}
        aria-pressed={muted}
      >
        {muted ? <MicOff /> : <Mic />}
        {muted ? "Unmute" : "Mute"}
      </Button>
      <Button variant="outline" size="lg" className="rounded-full px-4" onClick={onEnd} disabled={busy}>
        {busy ? <Loader className="animate-spin" /> : <PhoneOff />}
        End voice
      </Button>
    </div>
  )
}
