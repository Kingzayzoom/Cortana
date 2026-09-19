"use client"

import { useEffect, useRef } from "react"

import { APP_NAME } from "@/lib/config"
import { cn } from "@/lib/utils"

export type TranscriptEntry = {
  id: string
  role: "assistant" | "user"
  text: string
  /** "voice" for the live conversation, "text" for typed questions answered by Gemini. */
  channel: "voice" | "text"
  sourceIds?: string[]
  error?: boolean
}

export function TranscriptPanel({ entries }: { entries: TranscriptEntry[] }) {
  const listRef = useRef<HTMLDivElement>(null)
  // Scroll the panel itself, never the page.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries.length])

  if (entries.length === 0) {
    return <p className="px-1 py-3 text-sm text-muted-foreground">The conversation will appear here.</p>
  }

  return (
    <div ref={listRef} className="max-h-72 space-y-3 overflow-y-auto pr-1">
      {entries.map((e) => (
        <div key={e.id} className="text-sm">
          <p className={cn("eyebrow mb-0.5", e.role === "assistant" ? "text-primary" : "text-cyan")}>
            {e.role === "assistant" ? APP_NAME : "You"}
          </p>
          <p className={cn("leading-relaxed", e.error && "text-muted-foreground italic")}>{e.text}</p>
        </div>
      ))}
    </div>
  )
}
