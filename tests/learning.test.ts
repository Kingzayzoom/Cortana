import { describe, expect, it } from "vitest"

import { heartFailureRound } from "@/lib/content/cardiology/heart-failure"
import { gradeAnswer } from "@/lib/learning/grading"
import { canEnterStage, initialLesson, lessonReducer, type LessonAction, type LessonState } from "@/lib/learning/lesson"
import { addDays, completeRound, currentStreak, emptyProgress, recordAttempt, topicStats } from "@/lib/learning/progress"
import { nextReview } from "@/lib/learning/review"
import type { GradeResult } from "@/lib/learning/types"
import { createSampleProgress } from "@/lib/progress/seed"
import { parseOptionId, parseTypedAnswer } from "@/lib/validation/tools"

const TODAY = "2026-09-19"
const at = (date: string) => new Date(`${date}T10:00:00`)

describe("answer parsing", () => {
  it("normalizes spoken and typed option ids", () => {
    expect(parseOptionId("b")).toBe("B")
    expect(parseOptionId("option C")).toBe("C")
    expect(parseOptionId("Answer B")).toBe("B")
    expect(parseOptionId("E")).toBeNull()
  })

  it("treats short answers as answers and questions as questions", () => {
    expect(parseTypedAnswer("B")).toBe("B")
    expect(parseTypedAnswer("my answer is b")).toBe("B")
    expect(parseTypedAnswer("I think it's C.")).toBe("C")
    expect(parseTypedAnswer("is B right?")).toBeNull()
    expect(parseTypedAnswer("Who was included?")).toBeNull()
  })
})

describe("grading", () => {
  it("grades deterministically against the answer key", () => {
    expect(gradeAnswer("hf-round-001", "hf-q-001", "B")?.isCorrect).toBe(true)
    const wrong = gradeAnswer("hf-round-001", "hf-q-001", "A")
    expect(wrong?.isCorrect).toBe(false)
    expect(wrong?.correctOption).toBe("B")
    expect(wrong?.feedback).toMatch(/diabetes/)
  })

  it("returns null for unknown questions", () => {
    expect(gradeAnswer("hf-round-001", "missing", "A")).toBeNull()
  })
})

describe("lesson state machine", () => {
  const run = (...actions: LessonAction[]) =>
    actions.reduce<LessonState>(lessonReducer, initialLesson(heartFailureRound.id))
  const grade = { isCorrect: true } as GradeResult

  it("keeps the brief checkpoint across an interruption", () => {
    const s = run({ type: "start" }, { type: "show_section", index: 1 }, { type: "interrupted" })
    expect(s.stage).toBe("briefing")
    expect(s.sectionIndex).toBe(1)
    expect(s.interruptedSectionIndex).toBe(1)
    expect(lessonReducer(s, { type: "show_section", index: 2 }).interruptedSectionIndex).toBeNull()
  })

  it("requires a graded answer before the questions stage", () => {
    const s = run({ type: "start" }, { type: "show_case", caseId: "hf-case-001" })
    expect(canEnterStage(s, "questions").ok).toBe(false)
    expect(lessonReducer(s, { type: "show_stage", stage: "questions" }).stage).toBe("challenge")
    const graded = lessonReducer(s, { type: "answer_graded", grade })
    expect(graded.stage).toBe("feedback")
    expect(lessonReducer(graded, { type: "show_stage", stage: "questions" }).stage).toBe("questions")
  })

  it("only moves forward", () => {
    const s = run({ type: "start" }, { type: "show_case", caseId: "hf-case-001" }, { type: "answer_graded", grade }, { type: "show_stage", stage: "questions" })
    expect(lessonReducer(s, { type: "show_stage", stage: "briefing" }).stage).toBe("questions")
    expect(lessonReducer(s, { type: "show_section", index: 0 }).stage).toBe("questions")
  })
})

describe("progress", () => {
  const attempt = { roundId: "hf-round-001", questionId: "hf-q-001", topicId: "heart-failure", answer: "B" as const, isCorrect: true, confidence: null }

  it("counts only the first attempt per question per day", () => {
    let p = recordAttempt(emptyProgress(), attempt, at(TODAY))
    p = recordAttempt(p, { ...attempt, answer: "A", isCorrect: false }, at(TODAY))
    expect(p.attempts).toHaveLength(1)
    expect(p.attempts[0].isCorrect).toBe(true)
  })

  it("awards XP once and extends the streak from yesterday", () => {
    const base = { ...emptyProgress(), streak: { current: 5, longest: 5, lastCompletedOn: addDays(TODAY, -1) } }
    const withAttempt = recordAttempt(base, attempt, at(TODAY))
    const first = completeRound(withAttempt, { roundId: "hf-round-001", topicId: "heart-failure" }, at(TODAY))
    expect(first.summary.xpEarned).toBe(120)
    expect(first.summary.streak).toEqual({ current: 6, longest: 6, extended: true })

    const again = completeRound(first.progress, { roundId: "hf-round-001", topicId: "heart-failure" }, at(TODAY))
    expect(again.summary.alreadyCompleted).toBe(true)
    expect(again.progress.xp).toBe(first.progress.xp)
  })

  it("restarts a broken streak", () => {
    const base = { ...emptyProgress(), streak: { current: 5, longest: 5, lastCompletedOn: addDays(TODAY, -3) } }
    expect(currentStreak(base, TODAY)).toBe(0)
    const { summary } = completeRound(base, { roundId: "hf-round-001", topicId: "heart-failure" }, at(TODAY))
    expect(summary.streak.current).toBe(1)
    expect(summary.streak.longest).toBe(5)
  })
})

describe("sample history and next review", () => {
  it("seeds the demo profile described in the demo script", () => {
    const p = createSampleProgress(TODAY)
    expect(currentStreak(p, TODAY)).toBe(5)
    const hf = topicStats(p, "heart-failure", TODAY)
    expect([hf.correct, hf.total]).toEqual([1, 2])
    const htn = topicStats(p, "hypertension", TODAY)
    expect([htn.correct, htn.total]).toEqual([4, 4])
    expect(topicStats(p, "anticoagulation", TODAY).status).toBe("due")
  })

  it("flags a confident miss as a possible misconception", () => {
    const next = nextReview(createSampleProgress(TODAY), TODAY)
    expect(next?.topicId).toBe("anticoagulation")
    expect(next?.kind).toBe("misconception")
  })

  it("after today's correct heart failure answer, recommends the missed topic", () => {
    const p = recordAttempt(
      createSampleProgress(TODAY),
      { roundId: "hf-round-001", questionId: "hf-q-001", topicId: "heart-failure", answer: "B", isCorrect: true, confidence: "very" },
      at(TODAY),
    )
    const hf = topicStats(p, "heart-failure", TODAY)
    expect([hf.correct, hf.total]).toEqual([2, 3])
    expect(hf.dueOn).toBe(addDays(TODAY, 3))

    const next = nextReview(p, TODAY)
    expect(next?.topicId).toBe("anticoagulation")
    expect(next?.reason).toMatch(/missed your last practice question/)
  })
})
