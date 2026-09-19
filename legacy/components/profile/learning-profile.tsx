"use client"

import { RotateCcw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DEMO_PROFILE } from "@/lib/config"
import { currentStreak, localDate } from "@/lib/learning/progress"
import { describeDue, reviewQueue } from "@/lib/learning/review"
import { progressStore, useProgress } from "@/lib/progress/store"
import { cn } from "@/lib/utils"

export function LearningProfile() {
  const progress = useProgress()
  if (!progress) return <Card className="h-64 animate-pulse bg-secondary/50" />

  const today = localDate()
  const correct = progress.attempts.filter((a) => a.isCorrect).length
  const hasSample = progress.completions.some((c) => c.sample) || progress.attempts.some((a) => a.sample)

  const stats = [
    { label: "Rounds completed", value: progress.completions.length.toString() },
    { label: "Practice", value: `${correct} / ${progress.attempts.length} correct` },
    { label: "Current streak", value: `${currentStreak(progress, today)} days` },
    { label: "Total XP", value: progress.xp.toLocaleString() },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">{DEMO_PROFILE.name}</p>
        <span className="text-muted-foreground">· {DEMO_PROFILE.specialty}</span>
        <Badge variant="sample">Demo profile</Badge>
        {hasSample && <Badge variant="sample">Includes sample history</Badge>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <p className="eyebrow mb-2">{s.label}</p>
            <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
          </Card>
        ))}
      </div>

      <section>
        <p className="eyebrow mb-3">Review queue</p>
        <Card className="divide-y">
          {reviewQueue(progress, today).map(({ topic, stats }) => {
            const due = describeDue(stats, today)
            return (
              <div key={topic.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium">{topic.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.total > 0 ? `${stats.correct} / ${stats.total} correct` : "No practice yet"}
                  </p>
                </div>
                <span className={cn("text-sm text-muted-foreground", stats.status === "due" && "font-medium text-[oklch(0.5_0.12_60)]")}>
                  {due}
                </span>
              </div>
            )
          })}
        </Card>
      </section>

      <section className="rounded-2xl border border-dashed p-5">
        <p className="text-sm font-medium">Reset demo data</p>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">
          Progress is stored in this browser only. Resetting restores the sample history, dated relative to today.
        </p>
        <Button variant="outline" onClick={() => progressStore.resetToSample()}>
          <RotateCcw /> Reset to sample history
        </Button>
      </section>
    </div>
  )
}
