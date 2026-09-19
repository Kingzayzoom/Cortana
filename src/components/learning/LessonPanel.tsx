"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  BookOpen,
  Send,
  RotateCcw,
} from "lucide-react";
import { useLearning } from "@/lib/learning/provider";
import { useVoice } from "@/lib/voice/provider";
import { round, ROUND_ID } from "@/lib/content/round";
import type { Grade } from "@/lib/learning/types";
import { Button } from "@/components/ui/button";
export function LessonPanel() {
  const { data, act, busy, openEvidence, addMessage } = useLearning();
  const voice = useVoice();
  const panel = useRef<HTMLElement>(null);
  const [typed, setTyped] = useState(""),
    [question, setQuestion] = useState(""),
    [clarification, setClarification] = useState<Grade | null>(null),
    [reply, setReply] = useState<{
      answer: string;
      sourceIds: string[];
    } | null>(null);
  const run = data?.run;
  const lessonStage = run?.stage;
  const sectionIndex = run?.section;
  useEffect(() => {
    if (!lessonStage || voice.paused) return;
    if (
      voice.preview ||
      ["challenge", "feedback", "questions"].includes(lessonStage)
    ) {
      const frame = requestAnimationFrame(() =>
        panel.current?.scrollIntoView({ block: "start", behavior: "instant" }),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [lessonStage, sectionIndex, voice.preview, voice.paused]);
  if (
    !run ||
    run.stage === "ready" ||
    !(voice.preview || voice.connection === "connected" || run.completed)
  )
    return null;
  const section = round.sections[run.section];
  const advance = async () => {
    if (!voice.preview) {
      voice.send(
        run.section < 2
          ? "Please continue to the next briefing section, updating the section with show_stage before reading it."
          : "Please call show_case with caseId hf-case-01 and read the synthetic challenge.",
        run.section < 2
          ? "Continue to the next section."
          : "Try the challenge.",
      );
      return;
    }
    addMessage({
      id: crypto.randomUUID(),
      role: "assistant",
      text: section.text,
      preview: true,
    });
    await act({
      action: "stage",
      runId: run.id,
      stageId: run.section < 2 ? "briefing" : "challenge",
      ...(run.section < 2
        ? { sectionId: round.sections[run.section + 1].id }
        : {}),
    });
  };
  const submit = async (answer: string) => {
    const result = await act({
      action: "answer",
      runId: run.id,
      roundId: ROUND_ID,
      questionId: round.case.questionId,
      answer,
      requestId: crypto.randomUUID(),
    });
    setClarification(result.grade?.verdict === "clarify" ? result.grade : null);
    if (voice.preview)
      addMessage({
        id: crypto.randomUUID(),
        role: "user",
        text: answer,
        preview: true,
      });
    if (voice.connection === "connected")
      voice.send(
        `I selected ${answer}. Please call submit_answer to retrieve the authoritative grade before explaining it.`,
        answer,
      );
    setTyped("");
  };
  const ask = async (text: string) => {
    if (!text.trim()) return;
    if (!voice.preview) {
      voice.send(text);
      setQuestion("");
      return;
    }
    addMessage({ id: crypto.randomUUID(), role: "user", text, preview: true });
    const result = await act({
      action: "question",
      runId: run.id,
      question: text,
    });
    setReply({ answer: result.answer!, sourceIds: result.sourceIds || [] });
    setQuestion("");
    addMessage({
      id: crypto.randomUUID(),
      role: "assistant",
      text: result.answer!,
      preview: true,
    });
  };
  const questionForm = (
    <div className="question-area">
      <p className="small muted">
        {voice.preview
          ? "Local preview answers a small set of source questions. Voice supports natural follow-ups when configured."
          : "Ask by voice or type a question about this round."}
      </p>
      <div className="suggested-questions">
        {[
          "Who was studied?",
          "Was diabetes required?",
          "What are the limitations?",
        ].map((text) => (
          <button
            key={text}
            disabled={busy || voice.paused}
            onClick={() => {
              void ask(text).catch(() => {});
            }}
          >
            {text}
          </button>
        ))}
      </div>
      <form
        className="inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question).catch(() => {});
        }}
      >
        <input
          className="input"
          aria-label="Question about this round"
          placeholder="Ask about the evidence…"
          value={question}
          maxLength={600}
          onChange={(event) => setQuestion(event.target.value)}
          disabled={voice.paused}
        />
        <button
          className="icon-button send-button"
          aria-label="Send question"
          disabled={busy || !question.trim() || voice.paused}
        >
          <Send size={18} />
        </button>
      </form>
      {reply && (
        <div className="question-reply" role="status">
          <p>{reply.answer}</p>
          {reply.sourceIds.map((id) => (
            <button
              className="text-button"
              key={id}
              onClick={() => openEvidence(id)}
            >
              <BookOpen size={14} />
              Supporting evidence
            </button>
          ))}
        </div>
      )}
    </div>
  );
  return (
    <section
      ref={panel}
      className="lesson-panel"
      aria-label="Current learning section"
    >
      <div className="lesson-heading">
        <span className="tag">
          {voice.preview ? "LOCAL PREVIEW" : "YOUR ROUND"}
        </span>
        <span className="small muted">{round.title}</span>
      </div>
      {run.stage === "briefing" && (
        <>
          <div className="section-progress">
            {round.sections.map((s, index) => (
              <span key={s.id} className={index <= run.section ? "done" : ""} />
            ))}
          </div>
          <p className="small muted">
            The brief · Section {run.section + 1} of 3
          </p>
          <h2>{section.title}</h2>
          <p className="lesson-prose">{section.text}</p>
          <div className="lesson-actions">
            <button
              className="text-button"
              onClick={() => openEvidence(section.sourceIds[0])}
            >
              <BookOpen size={16} />
              View supporting source
            </button>
            <Button
              disabled={busy || voice.paused}
              onClick={() => {
                void advance().catch(() => {});
              }}
            >
              {run.section < 2 ? "Continue" : "Try the challenge"}
              <ArrowRight size={16} />
            </Button>
          </div>
          <details className="brief-question">
            <summary>Have a question before continuing?</summary>
            {questionForm}
          </details>
        </>
      )}
      {run.stage === "challenge" && (
        <>
          <span className="case-label">{round.case.label}</span>
          <h2>A moment to think.</h2>
          <p className="lesson-prose">{round.case.description}</p>
          <h3>{round.case.question}</h3>
          <div className="answer-options">
            {round.case.options.map((option) => (
              <button
                key={option.id}
                disabled={busy || voice.paused}
                onClick={() => {
                  void submit(option.id).catch(() => {});
                }}
              >
                <span>{option.id}</span>
                {option.text}
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submit(typed).catch(() => {});
            }}
          >
            <input
              className="input"
              aria-label="Your answer"
              placeholder="Or type your answer: A, B, or C"
              value={typed}
              maxLength={600}
              onChange={(event) => setTyped(event.target.value)}
              disabled={voice.paused}
            />
            <button
              className="icon-button send-button"
              aria-label="Submit answer"
              disabled={busy || !typed.trim() || voice.paused}
            >
              <Send size={18} />
            </button>
          </form>
          {clarification && (
            <p className="clarification" role="status">
              {clarification.explanation}
            </p>
          )}
        </>
      )}
      {run.stage === "feedback" && run.grade && (
        <>
          <div className={`feedback-icon ${run.grade.verdict}`}>
            <Check size={23} />
          </div>
          <h2>
            {run.grade.verdict === "correct"
              ? "That’s the distinction."
              : "Not quite. Let’s look together."}
          </h2>
          <p className="lesson-prose">{run.grade.explanation}</p>
          <div className="takeaway">
            <strong>One thing to take with you</strong>
            <p>{run.grade.takeaway}</p>
          </div>
          <div className="lesson-actions">
            <button
              className="text-button"
              onClick={() => openEvidence(run.grade!.sourceIds[0])}
            >
              <BookOpen size={16} />
              See the evidence
            </button>
            <Button
              disabled={busy || voice.paused}
              onClick={() => {
                void act({
                  action: "stage",
                  runId: run.id,
                  stageId: "questions",
                })
                  .then(() => {
                    if (!voice.preview)
                      voice.send("Let’s move to my questions.");
                  })
                  .catch(() => {});
              }}
            >
              Your questions
              <ArrowRight size={16} />
            </Button>
          </div>
        </>
      )}
      {run.stage === "questions" && (
        <>
          <h2>What’s on your mind?</h2>
          <p className="lesson-prose">
            Make the evidence your own. Ask one more question, or finish your
            round.
          </p>
          {questionForm}
          <div className="lesson-actions align-end">
            <Button
              disabled={busy || voice.paused}
              onClick={() => {
                void act({
                  action: "complete",
                  runId: run.id,
                  roundId: ROUND_ID,
                  requestId: crypto.randomUUID(),
                })
                  .then(() => voice.end())
                  .catch(() => {});
              }}
            >
              Complete round
              <CheckCircle2 size={17} />
            </Button>
          </div>
        </>
      )}
      {run.stage === "completed" && (
        <>
          <div className="feedback-icon correct">
            <Check size={24} />
          </div>
          <h2>A little more learned.</h2>
          <p className="lesson-prose">
            Your round is complete and your practice is saved.{" "}
            {data?.review?.reason}
          </p>
          <div className="completion-facts">
            <span>
              <strong>
                {data?.completions.find((c) => c.roundId === ROUND_ID)?.xp} XP
              </strong>
              earned for this round
            </span>
            <span>
              <strong>{data?.review?.date}</strong>suggested review
            </span>
          </div>
          <p className="small muted">
            Repeating this round adds practice, without awarding completion XP
            again.
          </p>
          <div className="lesson-actions">
            <button
              className="text-button"
              onClick={() => openEvidence("dapa-diabetes")}
            >
              <BookOpen size={16} />
              Revisit the evidence
            </button>
            <Button
              variant="secondary"
              onClick={voice.startPreview}
              disabled={voice.working}
            >
              <RotateCcw size={16} />
              Practice again
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
