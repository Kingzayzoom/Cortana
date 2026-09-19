import { Target } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import type { ReviewRecommendation } from "@/lib/learning/review"

export function UpNextCard({ next, loading }: { next: ReviewRecommendation | null; loading: boolean }) {
  if (loading) return <Card className="h-[112px] animate-pulse bg-secondary/50" />
  if (!next) return null

  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center gap-2">
        <Target className="size-4 text-lavender" />
        <p className="eyebrow">Up next</p>
      </div>
      <p className="font-semibold">{next.topicName}</p>
      <p className="mt-1 text-sm text-muted-foreground">{next.reason}</p>
      {!next.hasRound && (
        <Badge variant="outline" className="mt-3">
          Round content coming soon
        </Badge>
      )}
    </Card>
  )
}
