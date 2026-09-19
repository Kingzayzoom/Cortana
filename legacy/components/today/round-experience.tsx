"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { ConversationProvider, useConversation, useConversationClientTool } from "@elevenlabs/react"
import { AudioLines, BookOpen, Keyboard, MessageSquareText, Play, TriangleAlert } from "lucide-react"
import { z } from "zod"

import { LearningPulse } from "@/components/dashboard/learning-pulse"
import { StreakCard } from "@/components/dashboard/streak-card"
import { TodaysRoundPanel } from "@/components/dashboard/todays-round-panel"
import { UpNextCard } from "@/components/dashboard/up-next-card"
import { BriefingCard } from "@/components/learning/briefing-card"
import { CaseCard } from "@/components/learning/case-card"
import { Composer } from "@/components/learning/composer"
import { EvidenceDrawer } from "@/components/learning/evidence-drawer"
import { FeedbackCard } from "@/components/learning/feedback-card"
import { QuestionsPanel } from "@/components/learning/questions-panel"
import { RoundComplete } from "@/components/learning/round-complete"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CortanaOrb } from "@/components/voice/cortana-orb"
import { TranscriptPanel, type TranscriptEntry } from "@/components/voice/transcript-panel"
import { VoiceControls, VoiceStatus } from "@/components/voice/voice-controls"
import { APP_PILLARS, DEMO_PROFILE } from "@/lib/config"
import { getCase, getRound, getSource, type ClinicalCase, type OptionId, type Round } from "@/lib/content"
import { canEnterStage, currentSection, initialLesson, lessonReducer, type LessonAction, type LessonState } from "@/lib/learning/lesson"
import { nextReview } from "@/lib/learning/review"
import { buildRoundContext } from "@/lib/learning/round-context"
import type { CompletionSummary, Confidence, GradeResult } from "@/lib/learning/types"
import { progressStore, useProgress } from "@/lib/progress/store"
import { cn } from "@/lib/utils"
import { parseTypedAnswer, toolParams, type ToolName } from "@/lib/validation/tools"
import { deriveVoiceState, type ConnectionState } from "@/lib/voice/state"
import { useVoiceActivity } from "@/lib/voice/use-voice-activity"

export function TodayExperience({ roundId }: { roundId: string }) {
  const round = getRound(roundId)
  const clinicalCase = round && getCase(round.caseId)
  if (!round || !clinicalCase) return <p className="p-8 text-muted-foreground">Round “{roundId}” isn’t in the content bundle.</p>

  return (
    <ConversationProvider>
      <RoundExperience round={round} clinicalCase={clinicalCase} />
    </ConversationProvider>
  )
}

/** Registers an ElevenLabs client tool whose parameters are validated with Zod first. */
function useLessonTool<N extends ToolName>(
  name: N,
  run: (params: z.output<(typeof toolParams)[N]>) => string | Promise<string>,
) {
  useConversationClientTool(name, async (raw: Record<string, unknown>) => {
    const schema = toolParams[name] as unknown as z.ZodType<z.output<(typeof toolParams)[N]>>
    const parsed = schema.safeParse(raw ?? {})
    if (!parsed.success) return `error: invalid parameters for ${name}. ${z.prettifyError(parsed.error)}`
    try {
      return await run(parsed.data)
    } catch (err) {
      return `error: ${err instanceof Error ? err.message : `${name} failed`}`
    }
  })
}

type RunMode = "voice" | "text" | null
type VoiceNotice = { message: string } | null

function RoundExperience({ round, clinicalCase }: { round: Round; clinicalCase: ClinicalCase }) {
  // Lesson state lives in a ref as well as React state so tool handlers that
  // fire back-to-back always see the latest checkpoint, not the last render's.
  const [lesson, setLesson] = useState<LessonState>(() => initialLesson(round.id))
  const lessonRef = useRef(lesson)
  const apply = useCallback((action: LessonAction) => {
    lessonRef.current = lessonReducer(lessonRef.current, action)
    setLesson(lessonRef.current)
  }, [])

  const [runMode, setRunMode] = useState<RunMode>(null)
  const [preparing, setPreparing] = useState(false)
  const [ending, setEnding] = useState(false)
  const [notice, setNotice] = useState<VoiceNotice>(null)
  const [awaitingResponse, setAwaitingResponse] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [showTranscript, setShowTranscript] = useState(false)
  const [asking, setAsking] = useState(false)

  const progress = useProgress()
  const upNext = useMemo(() => (progress ? nextReview(progress) : null), [progress])

  const gradeRef = useRef<GradeResult | null>(null)
  const gradingRef = useRef<Promise<GradeResult> | null>(null)
  const entryCounter = useRef(0)

  const addEntry = useCallback((entry: Omit<TranscriptEntry, "id">) => {
    const id = `${Date.now()}-${++entryCounter.current}`
    setTranscript((t) => [...t, { ...entry, id }])
  }, [])

  // ---- Voice session ----

  const conversation = useConversation({
    onStatusChange: ({ status }) => {
      if (status !== "disconnected") setPreparing(false)
    },
    onMessage: ({ message, role }) => {
      addEntry({ role: role === "agent" ? "assistant" : "user", text: message, channel: "voice" })
      setAwaitingResponse(role === "user")
    },
    onModeChange: ({ mode }) => {
      if (mode === "speaking") setAwaitingResponse(false)
    },
    onInterruption: () => apply({ type: "interrupted" }),
    onDisconnect: (details) => {
      setPreparing(false)
      setEnding(false)
      setAwaitingResponse(false)
      if (details.reason === "error") setNotice({ message: `Voice disconnected: ${details.message}` })
      // Keep the round going on screen.
      const stage = lessonRef.current.stage
      setRunMode(stage === "ready" ? null : "text")
    },
    onError: (message) => {
      setPreparing(false)
      setNotice({ message })
    },
  })

  const status = conversation.status
  const connected = status === "connected"
  const connection: ConnectionState =
    preparing || status === "connecting"
      ? "connecting"
      : connected
        ? ending
          ? "disconnecting"
          : "connected"
        : status === "error"
          ? "error"
          : "idle"

  const activity = useVoiceActivity({
    active: connected,
    getInputVolume: conversation.getInputVolume,
    getOutputVolume: conversation.getOutputVolume,
  })
  const voice = deriveVoiceState({
    connected,
    agentSpeaking: conversation.isSpeaking,
    userSpeaking: activity.userSpeaking && !conversation.isMuted,
    awaitingResponse,
  })

  const startVoice = useCallback(async () => {
    setNotice(null)
    setPreparing(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
    } catch {
      setPreparing(false)
      setNotice({ message: "Microphone access is blocked. Allow it in your browser, or read the round instead." })
      return
    }

    let conversationToken: string
    try {
      const res = await fetch("/api/elevenlabs/session", { cache: "no-store" })
      const body = (await res.json().catch(() => ({}))) as { conversationToken?: string; message?: string }
      if (!res.ok || !body.conversationToken) throw new Error(body.message ?? "Couldn't start a voice session.")
      conversationToken = body.conversationToken
    } catch (err) {
      setPreparing(false)
      setNotice({ message: err instanceof Error ? err.message : "Couldn't start a voice session." })
      return
    }

    setRunMode("voice")
    if (lessonRef.current.stage === "ready") apply({ type: "start" })
    conversation.startSession({
      conversationToken,
      connectionType: "webrtc",
      dynamicVariables: { round_id: round.id, learner_name: DEMO_PROFILE.shortName },
    })
  }, [apply, conversation, round.id])

  const endVoice = useCallback(() => {
    setEnding(true)
    conversation.endSession()
  }, [conversation])

  const startReading = useCallback(() => {
    setNotice(null)
    setRunMode("text")
    if (lessonRef.current.stage === "ready") apply({ type: "start" })
  }, [apply])

  // ---- Learning actions (shared by voice tools, clicks and typing) ----

  const submitAnswer = useCallback(
    async (answer: OptionId, confidence: Confidence | null): Promise<GradeResult> => {
      if (gradeRef.current) return gradeRef.current
      if (gradingRef.current) return gradingRef.current

      apply({ type: "answer_pending", answer })
      const request = (async () => {
        const res = await fetch(`/api/rounds/${round.id}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: clinicalCase.questionId, answer }),
        })
        if (!res.ok) throw new Error(`Grading failed (${res.status}).`)
        return (await res.json()) as GradeResult
      })()
      gradingRef.current = request

      try {
        const grade = await request
        gradeRef.current = grade
        progressStore.recordAttempt({
          roundId: round.id,
          questionId: grade.questionId,
          topicId: round.topicId,
          answer: grade.submitted,
          isCorrect: grade.isCorrect,
          confidence,
        })
        apply({ type: "answer_graded", grade })
        return grade
      } catch (err) {
        apply({ type: "answer_failed" })
        throw err
      } finally {
        gradingRef.current = null
      }
    },
    [apply, clinicalCase.questionId, round.id, round.topicId],
  )

  const finishRound = useCallback((): CompletionSummary => {
    const existing = lessonRef.current.completion
    if (existing) return existing
    const summary = progressStore.completeRound({ roundId: round.id, topicId: round.topicId })
    apply({ type: "complete", completion: summary })
    return summary
  }, [apply, round.id, round.topicId])

  const openEvidence = useCallback((sourceIds: string[]) => apply({ type: "open_evidence", sourceIds }), [apply])
  const closeEvidence = useCallback(() => apply({ type: "close_evidence" }), [apply])

  /** Sends text into the live conversation and mirrors it in the transcript. */
  const say = useCallback(
    (text: string) => {
      addEntry({ role: "user", text, channel: "voice" })
      conversation.sendUserMessage(text)
    },
    [addEntry, conversation],
  )

  const answerFromScreen = useCallback(
    async (option: OptionId) => {
      try {
        await submitAnswer(option, lessonRef.current.confidence)
        // The agent grades through the same cached result and explains it aloud.
        if (connected) say(`My answer is ${option}.`)
      } catch {
        setNotice({ message: "Couldn’t grade that answer. Please try again." })
      }
    },
    [connected, say, submitAnswer],
  )

  const ask = useCallback(
    async (question: string) => {
      if (connected) {
        say(question)
        return
      }
      addEntry({ role: "user", text: question, channel: "text" })
      setAsking(true)
      try {
        const res = await fetch(`/api/rounds/${round.id}/ask`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        })
        const body = (await res.json().catch(() => ({}))) as {
          answer?: string
          sourceIds?: string[]
          error?: string
          message?: string
        }
        if (!res.ok || !body.answer) {
          const text =
            body.error === "not_configured"
              ? "Typed questions need Gemini. Add GEMINI_API_KEY to .env.local and restart the dev server."
              : (body.message ?? "I couldn’t answer that right now.")
          addEntry({ role: "assistant", text, channel: "text", error: true })
          return
        }
        addEntry({ role: "assistant", text: body.answer, channel: "text", sourceIds: body.sourceIds })
      } catch {
        addEntry({ role: "assistant", text: "Network error — please try again.", channel: "text", error: true })
      } finally {
        setAsking(false)
      }
    },
    [addEntry, connected, round.id, say],
  )

  const onCompose = useCallback(
    (text: string) => {
      if (lessonRef.current.stage === "challenge") {
        const option = parseTypedAnswer(text)
        if (option) {
          void answerFromScreen(option)
          return
        }
      }
      void ask(text)
    },
    [answerFromScreen, ask],
  )

  const onFinish = useCallback(() => {
    finishRound()
    if (connected) say("I'm done — let's wrap up the round.")
  }, [connected, finishRound, say])

  const restart = useCallback(() => {
    if (connected) conversation.endSession()
    gradeRef.current = null
    apply({ type: "reset" })
    setTranscript([])
    setRunMode(null)
    setNotice(null)
  }, [apply, connected, conversation])

  // ---- ElevenLabs client tools (contracts in docs/tool-contracts.md) ----

  useLessonTool("get_round_context", () =>
    JSON.stringify({
      ...buildRoundContext(round),
      checkpoint: {
        stage: lessonRef.current.stage,
        current_section_id: currentSection(lessonRef.current, round).id,
        interrupted_section_id:
          lessonRef.current.interruptedSectionIndex === null ? null : round.sections[lessonRef.current.interruptedSectionIndex]?.id,
        answer_graded: Boolean(gradeRef.current),
        round_completed: Boolean(lessonRef.current.completion),
      },
    }),
  )

  useLessonTool("show_stage", ({ stage }) => {
    const check = canEnterStage(lessonRef.current, stage)
    if (!check.ok) return `error: ${check.reason}`
    apply({ type: "show_stage", stage })
    return `ok: stage is now "${lessonRef.current.stage}".`
  })

  useLessonTool("show_section", ({ section_id }) => {
    const index = round.sections.findIndex((s) => s.id === section_id)
    if (index < 0) return `error: unknown section_id. Valid ids: ${round.sections.map((s) => s.id).join(", ")}.`
    if (!["ready", "briefing"].includes(lessonRef.current.stage)) return "error: the brief is already finished."
    apply({ type: "show_section", index })
    const section = round.sections[index]
    return JSON.stringify({
      ok: true,
      section: { section_id: section.id, title: section.title, points: section.points },
      instruction: "Speak 2–3 conversational sentences using only these points.",
    })
  })

  useLessonTool("show_case", ({ case_id }) => {
    if (case_id !== round.caseId) return `error: unknown case_id. This round's case is "${round.caseId}".`
    if (lessonRef.current.stage === "questions" || lessonRef.current.stage === "completed") {
      return "error: the challenge is already finished."
    }
    apply({ type: "show_case", caseId: case_id })
    return JSON.stringify({
      ok: true,
      case: buildRoundContext(round).case,
      instruction: "Summarize the patient in one sentence, read the question, list the four options briefly, then wait.",
    })
  })

  useLessonTool("show_evidence", ({ source_ids }) => {
    const valid = source_ids.filter((id) => round.sourceIds.includes(id))
    if (valid.length === 0) return `error: no matching sources. Valid source_ids: ${round.sourceIds.join(", ")}.`
    apply({ type: "open_evidence", sourceIds: valid })
    return `ok: showing ${valid.map((id) => getSource(id)?.shortName ?? id).join(" and ")} on screen.`
  })

  useLessonTool("submit_answer", async ({ answer, confidence }) => {
    const stage = lessonRef.current.stage
    if (!gradeRef.current && stage !== "challenge") return "error: present the case with show_case before submitting an answer."
    const alreadyGraded = Boolean(gradeRef.current)
    const grade = await submitAnswer(answer, confidence ?? lessonRef.current.confidence)
    return JSON.stringify({
      already_graded: alreadyGraded,
      learner_answer: grade.submitted,
      is_correct: grade.isCorrect,
      correct_option: grade.correctOption,
      feedback_for_learner_choice: grade.feedback,
      rationale: grade.rationale,
      worth_noting: grade.worthNoting ?? null,
      source_ids: grade.sourceIds,
      instruction: grade.isCorrect
        ? "Confirm it's correct in a few words, then explain why using the rationale."
        : "Say 'not quite' kindly, name the best-supported option, and explain using the feedback and rationale.",
    })
  })

  useLessonTool("complete_round", () => {
    if (!gradeRef.current) return "error: grade an answer with submit_answer before completing the round."
    const summary = finishRound()
    const next = nextReview(progressStore.get())
    return JSON.stringify({
      xp_earned: summary.xpEarned,
      breakdown: summary.breakdown,
      streak_days: summary.streak.current,
      streak_extended: summary.streak.extended,
      already_completed: summary.alreadyCompleted,
      next_review: next && { topic: next.topicName, reason: next.reason },
    })
  })

  useLessonTool("get_next_review", () => {
    const next = nextReview(progressStore.get())
    return JSON.stringify(next ? { topic: next.topicName, reason: next.reason, has_round: next.hasRound } : { topic: null })
  })

  // ---- Render ----

  const stage = lesson.stage
  const started = runMode !== null || stage !== "ready"
  const voiceLive = connection === "connected" || connection === "disconnecting"
  const textThread = transcript.filter((e) => e.channel === "text")

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow">{APP_PILLARS.join(" · ")}</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {DEMO_PROFILE.name} · {DEMO_PROFILE.specialty}
          </span>
          <Badge variant="sample">Demo profile</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 space-y-6">
          <div className="text-center">
            {started ? (
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
                Today’s round: <span className="text-primary">{round.title}</span>
              </h1>
            ) : (
              <h1 className="text-3xl font-semibold tracking-tight text-balance md:text-5xl">
                Your daily clinical <span className="bg-gradient-to-r from-primary to-lavender bg-clip-text text-transparent">conversation.</span>
              </h1>
            )}
          </div>

          <div className="flex flex-col items-center gap-4">
            <CortanaOrb
              connection={connection}
              voice={voice}
              inputEnergy={activity.inputEnergy}
              outputEnergy={activity.outputEnergy}
              className={cn(
                "transition-[width] duration-500",
                stage === "ready" || stage === "briefing" ? "w-[min(70vw,280px)]" : "w-[min(44vw,168px)]",
              )}
            />

            <VoiceStatus
              connection={connection}
              voice={voice}
              muted={conversation.isMuted}
              idleText={stage === "completed" ? "Round complete" : runMode === "text" ? "Reading mode · voice off" : undefined}
            />

            {stage === "ready" && runMode === null && (
              <div className="flex flex-col items-center gap-2">
                <Button size="lg" className="h-11 rounded-full px-6 text-[0.95rem] shadow-md" onClick={startVoice} disabled={connection === "connecting"}>
                  <Play className="fill-current" /> Start today’s round
                </Button>
                <button type="button" onClick={startReading} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
                  <BookOpen className="mr-1 inline size-3.5" />
                  Read it instead
                </button>
              </div>
            )}

            {voiceLive && (
              <VoiceControls connection={connection} muted={conversation.isMuted} onToggleMute={() => conversation.setMuted(!conversation.isMuted)} onEnd={endVoice} />
            )}

            {runMode === "text" && stage !== "completed" && connection === "idle" && (
              <Button variant="outline" className="rounded-full" onClick={startVoice}>
                <AudioLines /> Continue with voice
              </Button>
            )}

            {notice && (
              <div role="alert" className="flex max-w-lg items-start gap-2 rounded-xl border border-warning/40 bg-warning/8 px-4 py-3 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                <div className="space-y-2">
                  <p>{notice.message}</p>
                  {runMode === null && (
                    <Button size="sm" variant="outline" onClick={startReading}>
                      <Keyboard /> Continue without voice
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mx-auto w-full max-w-2xl space-y-4">
            {stage === "briefing" && (
              <BriefingCard
                round={round}
                sectionIndex={lesson.sectionIndex}
                interrupted={lesson.interruptedSectionIndex !== null}
                mode={runMode === "voice" ? "voice" : "text"}
                onBack={() => apply({ type: "show_section", index: Math.max(0, lesson.sectionIndex - 1) })}
                onNext={() =>
                  lesson.sectionIndex < round.sections.length - 1
                    ? apply({ type: "show_section", index: lesson.sectionIndex + 1 })
                    : apply({ type: "show_case", caseId: round.caseId })
                }
                onOpenEvidence={openEvidence}
              />
            )}

            {(stage === "challenge" || stage === "feedback") && (
              <CaseCard
                clinicalCase={clinicalCase}
                confidence={lesson.confidence}
                pendingAnswer={lesson.pendingAnswer}
                grade={lesson.grade}
                onConfidence={(c) => apply({ type: "set_confidence", confidence: c })}
                onAnswer={answerFromScreen}
              />
            )}

            {stage === "feedback" && lesson.grade && (
              <FeedbackCard
                grade={lesson.grade}
                showContinue={runMode !== "voice"}
                onContinue={() => apply({ type: "show_stage", stage: "questions" })}
                onOpenEvidence={openEvidence}
              />
            )}

            {stage === "questions" && (
              <QuestionsPanel thread={textThread} asking={asking} voiceActive={voiceLive} onAsk={ask} onFinish={onFinish} onOpenEvidence={openEvidence} />
            )}

            {stage === "completed" && lesson.completion && <RoundComplete summary={lesson.completion} next={upNext} onRestart={restart} />}

            {started && stage !== "completed" && (
              <Composer
                onSubmit={onCompose}
                disabled={asking || connection === "connecting"}
                placeholder={
                  stage === "challenge"
                    ? "Type A–D to answer, or ask a question…"
                    : voiceLive
                      ? "Type instead of speaking…"
                      : "Ask about today’s evidence…"
                }
              />
            )}

            {started && (
              <div className="rounded-2xl border bg-card/60 px-4 py-2">
                <button
                  type="button"
                  onClick={() => setShowTranscript((v) => !v)}
                  aria-expanded={showTranscript}
                  className="flex w-full items-center gap-2 py-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <MessageSquareText className="size-4" />
                  {showTranscript ? "Hide transcript" : "Show transcript"}
                  {transcript.length > 0 && <span className="ml-auto text-xs tabular-nums">{transcript.length}</span>}
                </button>
                {showTranscript && (
                  <div className="border-t pt-3 pb-2">
                    <TranscriptPanel entries={transcript} />
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <TodaysRoundPanel round={round} stage={stage} onViewEvidence={() => openEvidence(round.sourceIds)} />
          <UpNextCard next={upNext} loading={!progress} />
          <StreakCard progress={progress} />
        </aside>
      </div>

      <div className="mt-10">
        <LearningPulse progress={progress} />
      </div>

      <EvidenceDrawer open={lesson.evidence.open} sourceIds={lesson.evidence.sourceIds} review={round.review} onClose={closeEvidence} />
    </main>
  )
}
