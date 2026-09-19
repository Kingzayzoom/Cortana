import { Flame } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { addDays, currentStreak, localDate, type Progress } from "@/lib/learning/progress"
import { cn } from "@/lib/utils"

export function StreakCard({ progress }: { progress: Progress | null }) {
  if (!progress) return <Card className="h-[148px] animate-pulse bg-secondary/50" />

  const today = localDate()
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))
  const completedOn = new Set(progress.completions.map((c) => c.completedOn))
  const hasSample = progress.completions.some((c) => c.sample)
  const streak = currentStreak(progress, today)

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="eyebrow">Streak</p>
        {hasSample && <Badge variant="sample">Sample history</Badge>}
      </div>
      <div className="flex items-center gap-3">
        <Flame className={cn("size-8", streak > 0 ? "text-[oklch(0.68_0.18_45)]" : "text-muted-foreground/40")} />
        <div>
          <p className="text-2xl font-semibold tabular-nums">
            {streak} <span className="text-base font-medium">day{streak === 1 ? "" : "s"}</span>
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {progress.xp.toLocaleString()} XP · best {progress.streak.longest}
          </p>
        </div>
      </div>
      <div className="mt-4 flex justify-between gap-1">
        {days.map((d) => {
          const label = new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "narrow" })
          const done = completedOn.has(d)
          return (
            <div key={d} className="flex flex-1 flex-col items-center gap-1">
              <span
                className={cn(
                  "size-2.5 rounded-full bg-border",
                  done && "bg-primary",
                  d === today && !done && "ring-2 ring-primary/30",
                )}
                title={d}
              />
              <span className="text-[0.65rem] text-muted-foreground">{label}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
