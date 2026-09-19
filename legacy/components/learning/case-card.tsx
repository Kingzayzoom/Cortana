"use client"

import { Check, Loader } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import type { ClinicalCase, OptionId } from "@/lib/content/types"
import { CONFIDENCE_LABELS, CONFIDENCE_LEVELS, type Confidence, type GradeResult } from "@/lib/learning/types"
import { cn } from "@/lib/utils"

type Props = {
  clinicalCase: ClinicalCase
  confidence: Confidence | null
  pendingAnswer: OptionId | null
  grade: GradeResult | null
  onConfidence: (c: Confidence | null) => void
  onAnswer: (option: OptionId) => void
}

export function CaseCard({ clinicalCase, confidence, pendingAnswer, grade, onConfidence, onAnswer }: Props) {
  const locked = Boolean(grade || pendingAnswer)

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-4 overflow-hidden duration-500">
      <div className="border-b bg-secondary/60 px-5 py-2.5">
        <p className="eyebrow">{clinicalCase.label}</p>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <p className="font-medium">{clinicalCase.patient}</p>
          <ul className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
            {clinicalCase.findings.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-cyan" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[0.95rem] font-medium">{clinicalCase.question}</p>

        {!grade && (
          <fieldset className="flex flex-wrap items-center gap-1.5" disabled={locked}>
            <legend className="mr-1 mb-1.5 text-xs text-muted-foreground sm:float-left sm:mb-0">
              How confident are you? <span className="text-muted-foreground/70">(optional)</span>
            </legend>
            {CONFIDENCE_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={confidence === level}
                onClick={() => onConfidence(confidence === level ? null : level)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent",
                  confidence === level && "border-primary/40 bg-accent text-accent-foreground",
                )}
              >
                {CONFIDENCE_LABELS[level]}
              </button>
            ))}
          </fieldset>
        )}

        <div className="grid gap-2" role="radiogroup" aria-label="Answer options">
          {clinicalCase.options.map((o) => {
            const chosen = grade?.submitted === o.id || pendingAnswer === o.id
            const correct = grade?.correctOption === o.id
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={chosen}
                disabled={locked}
                onClick={() => onAnswer(o.id)}
                className={cn(
                  "group flex items-start gap-3 rounded-xl border bg-card px-3.5 py-3 text-left text-sm transition-all enabled:hover:border-primary/40 enabled:hover:bg-accent/60",
                  chosen && !grade && "border-primary/50 bg-accent",
                  grade && correct && "border-success/50 bg-success/8",
                  grade && chosen && !correct && "border-warning/60 bg-warning/8",
                  grade && !chosen && !correct && "opacity-55",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold text-muted-foreground",
                    chosen && !grade && "border-primary bg-primary text-primary-foreground",
                    grade && correct && "border-success bg-success text-white",
                    grade && chosen && !correct && "border-warning bg-warning text-white",
                  )}
                >
                  {pendingAnswer === o.id ? <Loader className="size-3 animate-spin" /> : grade && correct ? <Check className="size-3.5" /> : o.id}
                </span>
                <span className="pt-0.5 leading-snug">{o.text}</span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge variant="outline">Educational prototype</Badge>
          <Badge variant="outline">Synthetic case</Badge>
          <span className="text-xs text-muted-foreground">Not advice for any real patient.</span>
        </div>
      </div>
    </Card>
  )
}
