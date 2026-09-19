import { CircleCheck, Loader } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { TranscriptEntry } from "@/components/voice/transcript-panel"
import { APP_NAME } from "@/lib/config"
import { cn } from "@/lib/utils"

import { SourceChips } from "./source-chips"

export const SUGGESTED_QUESTIONS = [
  "Who was included in the study?",
  "What was the most important limitation?",
  "Give me the 15-second version.",
]

type Props = {
  /** Typed questions and Gemini's answers. Voice Q&A lives in the transcript. */
  thread: TranscriptEntry[]
  asking: boolean
  voiceActive: boolean
  onAsk: (question: string) => void
  onFinish: () => void
  onOpenEvidence: (ids: string[]) => void
}

export function QuestionsPanel({ thread, asking, voiceActive, onAsk, onFinish, onOpenEvidence }: Props) {
  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 space-y-4 p-5 duration-300">
      <div>
        <p className="eyebrow mb-1">Your questions</p>
        <p className="text-[0.95rem]">
          Before we finish, anything you’d like to clarify about today’s evidence?
          {voiceActive && <span className="text-muted-foreground"> Just ask out loud.</span>}
        </p>
      </div>

      {thread.length > 0 && (
        <div className="space-y-3 rounded-xl bg-secondary/60 p-3">
          {thread.map((e) => (
            <div key={e.id} className="text-sm">
              <p className={cn("eyebrow mb-0.5", e.role === "assistant" ? "text-primary" : "text-cyan")}>
                {e.role === "assistant" ? APP_NAME : "You"}
              </p>
              <p className={cn("leading-relaxed", e.error && "text-muted-foreground italic")}>{e.text}</p>
              {e.sourceIds && e.sourceIds.length > 0 && (
                <div className="mt-1.5">
                  <SourceChips sourceIds={e.sourceIds} onOpen={onOpenEvidence} />
                </div>
              )}
            </div>
          ))}
          {asking && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader className="size-3.5 animate-spin" /> Checking the evidence…
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={asking}
              onClick={() => onAsk(q)}
              className="rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
        <Button onClick={onFinish}>
          <CircleCheck /> Finish round
        </Button>
      </div>
    </Card>
  )
}
