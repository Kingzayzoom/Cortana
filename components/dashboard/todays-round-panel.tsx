import { ArrowRight, Check } from "lucide-react"

import { Card } from "@/components/ui/card"
import type { Round } from "@/lib/content/types"
import { roundStep, type LessonStage } from "@/lib/learning/lesson"
import { cn } from "@/lib/utils"

const STEPS = [
  { title: "The brief", detail: "A short spoken summary of the evidence" },
  { title: "The challenge", detail: "Apply it to a synthetic case" },
  { title: "Your questions", detail: "Ask anything about today’s evidence" },
]

type Props = {
  round: Round
  stage: LessonStage
  onViewEvidence: () => void
}

export function TodaysRoundPanel({ round, stage, onViewEvidence }: Props) {
  const active = roundStep(stage)
  const done = (i: number) => stage === "completed" || (active !== null && i < active)

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <p className="eyebrow">Today’s round</p>
        <p className="text-xs text-muted-foreground">~{round.estimatedMinutes} min</p>
      </div>

      <ol className="space-y-1">
        {STEPS.map((step, i) => {
          const isActive = active === i
          return (
            <li
              key={step.title}
              aria-current={isActive ? "step" : undefined}
              className={cn("flex gap-3 rounded-xl px-2 py-2.5 transition-colors", isActive && "bg-accent/70")}
            >
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border text-[0.7rem] font-semibold text-muted-foreground tabular-nums",
                  isActive && "border-primary bg-primary text-primary-foreground",
                  done(i) && "border-success/40 bg-success/10 text-success",
                )}
              >
                {done(i) ? <Check className="size-3.5" /> : `0${i + 1}`}
              </span>
              <div className="min-w-0">
                <p className={cn("text-sm font-medium", !isActive && !done(i) && "text-muted-foreground")}>{step.title}</p>
                <p className="text-xs text-muted-foreground">
                  {isActive ? (
                    <span className="inline-flex items-center gap-1 text-primary">
                      <span className="size-1.5 animate-pulse rounded-full bg-primary" /> Active
                    </span>
                  ) : (
                    step.detail
                  )}
                </p>
              </div>
            </li>
          )
        })}
      </ol>

      <div className="mt-5 border-t pt-4">
        <p className="eyebrow mb-1.5">Today’s focus</p>
        <p className="font-semibold">{round.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{round.focus}</p>
        <button
          type="button"
          onClick={onViewEvidence}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View evidence <ArrowRight className="size-3.5" />
        </button>
      </div>
    </Card>
  )
}
