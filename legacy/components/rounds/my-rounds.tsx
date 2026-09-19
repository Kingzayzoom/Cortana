"use client"

import Link from "next/link"
import { ArrowRight, CircleCheck, Headphones } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { getTopic, listRounds } from "@/lib/content"
import { localDate } from "@/lib/learning/progress"
import { useProgress } from "@/lib/progress/store"

export function MyRounds() {
  const progress = useProgress()
  const today = localDate()
  const completions = progress ? [...progress.completions].sort((a, b) => b.completedOn.localeCompare(a.completedOn)) : []

  return (
    <div className="space-y-10">
      <section>
        <p className="eyebrow mb-3">Today</p>
        <div className="grid gap-3 md:grid-cols-2">
          {listRounds().map((round) => {
            const doneToday = completions.some((c) => c.roundId === round.id && c.completedOn === today)
            return (
              <Card key={round.id} className="flex items-center gap-4 p-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <Headphones className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{round.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {round.specialty} · ~{round.estimatedMinutes} min
                  </p>
                </div>
                {doneToday ? (
                  <Badge variant="success">
                    <CircleCheck /> Completed today
                  </Badge>
                ) : (
                  <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                    Start <ArrowRight className="size-3.5" />
                  </Link>
                )}
              </Card>
            )
          })}
        </div>
      </section>

      <section>
        <p className="eyebrow mb-3">Completed</p>
        {!progress ? (
          <Card className="h-40 animate-pulse bg-secondary/50" />
        ) : completions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed rounds yet.</p>
        ) : (
          <Card className="divide-y">
            {completions.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-3.5">
                <CircleCheck className="size-4 shrink-0 text-success" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{getTopic(c.topicId)?.name ?? c.topicId}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(`${c.completedOn}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </p>
                </div>
                {c.sample && <Badge variant="sample">Sample</Badge>}
                <span className="text-sm text-muted-foreground tabular-nums">+{c.xpEarned} XP</span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  )
}
