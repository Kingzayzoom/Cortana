import { ArrowRight, CircleCheck, Info } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { GradeResult } from "@/lib/learning/types"
import { cn } from "@/lib/utils"

import { SourceChips } from "./source-chips"

type Props = {
  grade: GradeResult
  showContinue: boolean
  onContinue: () => void
  onOpenEvidence: (ids: string[]) => void
}

export function FeedbackCard({ grade, showContinue, onContinue, onOpenEvidence }: Props) {
  return (
    <Card
      className={cn(
        "animate-in fade-in slide-in-from-bottom-2 space-y-4 p-5 duration-300",
        grade.isCorrect ? "border-success/30" : "border-warning/40",
      )}
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        {grade.isCorrect ? (
          <>
            <CircleCheck className="size-5 text-success" />
            <p className="font-semibold text-success">Correct</p>
          </>
        ) : (
          <>
            <Info className="size-5 text-warning" />
            <p className="font-semibold text-[oklch(0.5_0.12_60)]">Not quite — let’s work through it.</p>
          </>
        )}
      </div>

      {!grade.isCorrect && (
        <p className="text-sm">
          <span className="font-medium">You chose {grade.submitted}. </span>
          {grade.feedback} The best-supported answer is <span className="font-medium">{grade.correctOption}</span>.
        </p>
      )}

      <div>
        <p className="eyebrow mb-1">Why</p>
        <p className="text-sm leading-relaxed text-foreground/85">{grade.rationale}</p>
      </div>

      {grade.worthNoting && (
        <div className="rounded-lg bg-secondary px-3 py-2">
          <p className="eyebrow mb-0.5">Worth noting</p>
          <p className="text-sm leading-relaxed text-foreground/80">{grade.worthNoting}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SourceChips sourceIds={grade.sourceIds} onOpen={onOpenEvidence} />
        {showContinue && (
          <Button onClick={onContinue}>
            Your questions <ArrowRight />
          </Button>
        )}
      </div>
    </Card>
  )
}
