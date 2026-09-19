import { ArrowRight, Check, Flame, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { ReviewRecommendation } from "@/lib/learning/review"
import type { CompletionSummary } from "@/lib/learning/types"

type Props = {
  summary: CompletionSummary
  next: ReviewRecommendation | null
  onRestart: () => void
}

export function RoundComplete({ summary, next, onRestart }: Props) {
  return (
    <Card className="animate-in fade-in zoom-in-95 space-y-5 p-6 duration-500">
      <div className="text-center">
        <p className="eyebrow mb-2">Round complete</p>
        <div className="flex justify-center gap-4 text-sm text-muted-foreground">
          {["Brief", "Challenge", "Questions"].map((s) => (
            <span key={s} className="flex items-center gap-1">
              <Check className="size-3.5 text-success" /> {s}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-accent/70 p-4">
          <p className="eyebrow mb-2">Earned</p>
          {summary.breakdown.map((b) => (
            <p key={b.label} className="flex justify-between text-sm">
              <span>{b.label}</span>
              <span className="font-semibold text-accent-foreground">+{b.xp} XP</span>
            </p>
          ))}
          {summary.alreadyCompleted && <p className="mt-1 text-xs text-muted-foreground">Already counted today.</p>}
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-[oklch(0.97_0.03_60)] p-4">
          <Flame className="size-8 text-[oklch(0.68_0.18_45)]" />
          <div>
            <p className="text-2xl font-semibold">{summary.streak.current}-day streak</p>
            <p className="text-xs text-muted-foreground">
              {summary.streak.extended ? "Extended today" : "Kept going"} · best {summary.streak.longest}
            </p>
          </div>
        </div>
      </div>

      {next && (
        <div className="flex items-start justify-between gap-3 rounded-xl border p-4">
          <div>
            <p className="eyebrow mb-1">Up next</p>
            <p className="font-medium">{next.topicName}</p>
            <p className="text-sm text-muted-foreground">{next.reason}</p>
          </div>
          <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
        </div>
      )}

      <div className="flex justify-center">
        <Button variant="ghost" onClick={onRestart}>
          <RotateCcw /> Run this round again
        </Button>
      </div>
    </Card>
  )
}
