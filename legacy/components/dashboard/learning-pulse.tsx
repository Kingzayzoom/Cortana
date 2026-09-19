import { Activity } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { topics } from "@/lib/content"
import { localDate, topicStats, type Progress } from "@/lib/learning/progress"
import { describeDue } from "@/lib/learning/review"
import { cn } from "@/lib/utils"

// Actual practice results only. No mastery percentages from a handful of answers.
export function LearningPulse({ progress }: { progress: Progress | null }) {
  const today = localDate()

  return (
    <section aria-labelledby="pulse-heading">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="size-4 text-primary" />
        <h2 id="pulse-heading" className="eyebrow">
          Your learning pulse
        </h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {topics.map((topic) => {
          if (!progress) return <Card key={topic.id} className="h-[104px] animate-pulse bg-secondary/50" />
          const stats = topicStats(progress, topic.id, today)
          const due = describeDue(stats, today)
          return (
            <Card key={topic.id} className="p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="font-medium">{topic.name}</p>
                {stats.sample && <Badge variant="sample">Sample</Badge>}
              </div>
              <p className="text-sm">
                {stats.total > 0 ? (
                  <>
                    <span className="font-semibold tabular-nums">
                      {stats.correct} / {stats.total}
                    </span>{" "}
                    <span className="text-muted-foreground">practice questions correct</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">No practice yet</span>
                )}
              </p>
              <p
                className={cn(
                  "mt-1 text-xs text-muted-foreground",
                  stats.status === "due" && "font-medium text-[oklch(0.5_0.12_60)]",
                )}
              >
                {stats.status === "due" ? "Review recommended" : `Next review: ${due.toLowerCase()}`}
              </p>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
