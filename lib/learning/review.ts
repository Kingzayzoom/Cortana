import { topics, type Topic } from "@/lib/content"

import { daysBetween, localDate, topicStats, type Progress, type TopicStats } from "./progress"

export type ReviewRecommendation = {
  topicId: string
  topicName: string
  kind: "misconception" | "missed" | "overdue" | "new" | "scheduled"
  reason: string
  hasRound: boolean
}

/**
 * Rule-based next review, explained in plain language:
 * 1. the most recent answer was wrong → that topic
 * 2. an overdue topic → the most overdue one
 * 3. an unseen topic → start it
 * 4. otherwise → whatever comes due first
 */
export function nextReview(p: Progress, today: string = localDate()): ReviewRecommendation | null {
  const stats = topics.map((t) => ({ topic: t, stats: topicStats(p, t.id, today) }))
  const recommend = (topic: Topic, kind: ReviewRecommendation["kind"], reason: string): ReviewRecommendation => ({
    topicId: topic.id,
    topicName: topic.name,
    kind,
    reason,
    hasRound: topic.roundIds.length > 0,
  })

  const latest = [...p.attempts].sort((a, b) => b.answeredAt.localeCompare(a.answeredAt))[0]
  if (latest && !latest.isCorrect) {
    const topic = topics.find((t) => t.id === latest.topicId)
    if (topic) {
      return latest.confidence === "very"
        ? recommend(topic, "misconception", "You were very confident but missed the last question — worth checking for a misconception.")
        : recommend(topic, "missed", "Recommended because you missed the previous practice question.")
    }
  }

  const due = stats
    .filter((s): s is { topic: Topic; stats: TopicStats & { dueOn: string } } => s.stats.status === "due" && !!s.stats.dueOn)
    .sort((a, b) => a.stats.dueOn.localeCompare(b.stats.dueOn))[0]
  if (due) {
    if (due.stats.lastAttempt && !due.stats.lastAttempt.isCorrect) {
      return recommend(due.topic, "missed", "Recommended because you missed your last practice question on this topic.")
    }
    const days = due.stats.lastSeenOn ? daysBetween(due.stats.lastSeenOn, today) : 0
    return recommend(due.topic, "overdue", `Last reviewed ${days} day${days === 1 ? "" : "s"} ago — due for review.`)
  }

  const unseen = stats.find((s) => s.stats.status === "not-started")
  if (unseen) return recommend(unseen.topic, "new", "A topic you haven't started yet.")

  const upcoming = stats
    .filter((s) => s.stats.dueOn)
    .sort((a, b) => (a.stats.dueOn ?? "").localeCompare(b.stats.dueOn ?? ""))[0]
  if (!upcoming?.stats.dueOn) return null
  const days = daysBetween(today, upcoming.stats.dueOn)
  return recommend(upcoming.topic, "scheduled", `Nothing is due. Next review in ${days} day${days === 1 ? "" : "s"}.`)
}

/** All topics with their review timing, due first. */
export function reviewQueue(p: Progress, today: string = localDate()) {
  const rank = { due: 0, scheduled: 1, "not-started": 2 } as const
  return topics
    .map((topic) => ({ topic, stats: topicStats(p, topic.id, today) }))
    .sort((a, b) => rank[a.stats.status] - rank[b.stats.status] || (a.stats.dueOn ?? "").localeCompare(b.stats.dueOn ?? ""))
}

export function describeDue(stats: TopicStats, today: string = localDate()): string {
  if (stats.status === "not-started" || !stats.dueOn) return "Not started"
  const days = daysBetween(today, stats.dueOn)
  if (days <= 0) return "Due now"
  return days === 1 ? "Tomorrow" : `In ${days} days`
}
