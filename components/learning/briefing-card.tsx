import { ArrowRight, Undo2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { Round } from "@/lib/content/types"

import { SourceChips } from "./source-chips"

type Props = {
  round: Round
  sectionIndex: number
  interrupted: boolean
  /** Text mode shows the full section with navigation; voice mode shows it as live notes. */
  mode: "voice" | "text"
  onBack: () => void
  onNext: () => void
  onOpenEvidence: (ids: string[]) => void
}

export function BriefingCard({ round, sectionIndex, interrupted, mode, onBack, onNext, onOpenEvidence }: Props) {
  const section = round.sections[sectionIndex]
  const last = sectionIndex === round.sections.length - 1

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 p-5 duration-300">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="eyebrow">
          The brief · {sectionIndex + 1} of {round.sections.length}
        </p>
        <div className="flex gap-1" aria-hidden="true">
          {round.sections.map((s, i) => (
            <span key={s.id} className={`h-1 w-6 rounded-full ${i <= sectionIndex ? "bg-primary" : "bg-border"}`} />
          ))}
        </div>
      </div>

      <h3 className="mb-2 text-lg font-semibold tracking-tight">{section.title}</h3>
      <ul className="space-y-1.5 text-[0.95rem] leading-relaxed text-foreground/85">
        {section.points.map((p) => (
          <li key={p} className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-primary/60" />
            {p}
          </li>
        ))}
      </ul>

      {interrupted && mode === "voice" && (
        <p className="mt-3 rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
          Paused here for your question. Say “continue” to pick up where we left off.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <SourceChips sourceIds={section.sourceIds} onOpen={onOpenEvidence} />
        {mode === "text" && (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onBack} disabled={sectionIndex === 0}>
              <Undo2 /> Back
            </Button>
            <Button onClick={onNext}>
              {last ? "Try the case" : "Next"} <ArrowRight />
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
