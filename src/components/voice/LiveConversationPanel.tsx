"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, Send } from "lucide-react";
import { useLearning } from "@/lib/learning/provider";
import { useVoice } from "@/lib/voice/provider";
import { round, ROUND_ID } from "@/lib/content/round";
import { Button } from "@/components/ui/button";

/** One conversation surface. SDK messages remain the source of live dialogue. */
export function LiveConversationPanel({ active }: { active: boolean }) {
  const { data, act, busy, addMessage, openEvidence } = useLearning();
  const voice = useVoice();
  const transcript = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const [jump, setJump] = useState(false);
  const [typed, setTyped] = useState("");
  const [clarification, setClarification] = useState("");
  const run = data?.run;
  const [lastMessages, setLastMessages] = useState(voice.messages);
  if (voice.messages.length > 0 && voice.messages !== lastMessages)
    setLastMessages(voice.messages);
  const messages =
    run?.completed && voice.messages.length === 0
      ? lastMessages
      : voice.messages;
  // Anchor the case once, before subsequent turns, and retain it after grading.
  const [caseAnchor, setCaseAnchor] = useState<{
    runId: string;
    before: string | null;
  } | null>(null);
  const hasCase =
    run &&
    ["challenge", "feedback", "questions", "completed"].includes(run.stage);
  if (active && hasCase && caseAnchor?.runId !== run.id) {
    setCaseAnchor({ runId: run.id, before: messages.at(-1)?.id ?? null });
  }
  const caseVisible = active && caseAnchor?.runId === run?.id;
  const anchorIndex = caseVisible
    ? messages.findIndex((message) => message.id === caseAnchor?.before)
    : -1;

  // Local preview reads the reviewed source text; never synthesize live speech.
  useEffect(() => {
    if (!active || !voice.preview || !run || run.stage !== "briefing") return;
    addMessage({
      id: `preview-${run.id}-section-${run.section}`,
      role: "assistant",
      text: round.sections[run.section].text,
      preview: true,
    });
  }, [active, voice.preview, run, addMessage]);

  const scrollToLatest = () => {
    const node = transcript.current;
    if (!node) return;
    following.current = true;
    setJump(false);
    node.scrollTo({
      top: node.scrollHeight,
      behavior:
        data?.preferences.reducedMotion ||
        matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
    });
  };
  useEffect(() => {
    if (!active) {
      following.current = true;
      setJump(false);
      return;
    }
    const node = transcript.current;
    if (!node) return;
    if (following.current) {
      node.scrollTo({
        top: node.scrollHeight,
        behavior:
          data?.preferences.reducedMotion ||
          matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
      });
    } else setJump(true);
  }, [
    active,
    messages,
    run?.stage,
    caseVisible,
    data?.preferences.reducedMotion,
  ]);

  const submit = async (text: string) => {
    if (!run || !text.trim()) return;
    if (run.stage === "challenge") {
      const result = await act({
        action: "answer",
        runId: run.id,
        roundId: ROUND_ID,
        questionId: round.case.questionId,
        answer: text,
        requestId: crypto.randomUUID(),
      });
      setClarification(
        result.grade?.verdict === "clarify" ? result.grade.explanation : "",
      );
      if (voice.preview) {
        addMessage({
          id: crypto.randomUUID(),
          role: "user",
          text,
          preview: true,
        });
        if (result.grade)
          addMessage({
            id: crypto.randomUUID(),
            role: "assistant",
            text: result.grade.explanation,
            preview: true,
          });
      } else {
        voice.send(
          `I selected ${text}. Please call submit_answer to retrieve the authoritative grade before explaining it.`,
          text,
        );
      }
    } else if (voice.preview) {
      addMessage({
        id: crypto.randomUUID(),
        role: "user",
        text,
        preview: true,
      });
      const result = await act({
        action: "question",
        runId: run.id,
        question: text,
      });
      if (result.answer)
        addMessage({
          id: crypto.randomUUID(),
          role: "assistant",
          text: result.answer,
          preview: true,
        });
    } else voice.send(text, undefined, "question");
    setTyped("");
  };
  const advancePreview = async () => {
    if (!run) return;
    if (run.stage === "questions") {
      await act({
        action: "complete",
        runId: run.id,
        roundId: ROUND_ID,
        requestId: crypto.randomUUID(),
      });
      voice.end();
    } else {
      await act({
        action: "stage",
        runId: run.id,
        stageId:
          run.stage === "feedback"
            ? "questions"
            : run.section < 2
              ? "briefing"
              : "challenge",
        ...(run.stage === "briefing" && run.section < 2
          ? { sectionId: round.sections[run.section + 1].id }
          : {}),
      });
    }
  };
  const challenge = (
    <section
      className="transcript-challenge"
      aria-label="Synthetic clinical challenge"
    >
      <span className="case-label">Synthetic clinical challenge</span>
      <p>{round.case.description}</p>
      <h3>{round.case.question}</h3>
      <div className="answer-options">
        {round.case.options.map((option) => (
          <button
            key={option.id}
            disabled={busy || voice.paused || run?.stage !== "challenge"}
            onClick={() => void submit(option.id).catch(() => {})}
          >
            <span>{option.id}</span>
            {option.text}
          </button>
        ))}
      </div>
      {clarification && run?.stage === "challenge" && (
        <p role="status">{clarification}</p>
      )}
    </section>
  );
  const connected = voice.connection === "connected";
  const canSend = (connected || voice.preview) && !run?.completed;
  return (
    <aside
      className="live-intelligence-panel"
      aria-label="Live conversation"
      aria-hidden={!active}
      inert={!active ? true : undefined}
    >
      <header className="conversation-header">
        <h2>Live conversation</h2>
        <span>
          {run?.completed
            ? "Complete"
            : voice.preview
              ? "Text preview"
              : connected
                ? "● Live"
                : "Connecting"}
        </span>
      </header>
      <div
        className="conversation-scroll"
        ref={transcript}
        tabIndex={0}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-label="Conversation between you and Samantha"
        onWheel={(event) => {
          if (event.deltaY < 0) following.current = false;
        }}
        onTouchMove={() => {
          following.current = false;
        }}
        onKeyDown={(event) => {
          if (["ArrowUp", "PageUp", "Home"].includes(event.key))
            following.current = false;
        }}
        onScroll={(event) => {
          const node = event.currentTarget;
          const nearBottom =
            node.scrollHeight - node.scrollTop - node.clientHeight < 64;
          following.current = nearBottom;
          setJump(!nearBottom);
        }}
      >
        {messages.length === 0 && !caseVisible && (
          <p className="conversation-empty">
            Your conversation will appear here as you and Samantha speak.
          </p>
        )}
        {caseVisible && anchorIndex === -1 && challenge}
        {messages.map((message, index) => (
          <Fragment key={message.id}>
            <article
              className={`conversation-turn${index === messages.length - 1 && message.role === "assistant" && voice.activity === "assistant-speaking" ? " is-speaking" : ""}`}
            >
              <span className="conversation-speaker">
                {message.role === "user" ? "You" : "Samantha"}
              </span>
              <p>{message.text}</p>
            </article>
            {caseVisible && index === anchorIndex && challenge}
          </Fragment>
        ))}
        {connected && voice.activity === "user-speaking" && (
          <div className="conversation-listening" role="status">
            <span />
            You · Listening…
          </div>
        )}
        {run?.completed && (
          <div className="conversation-complete" role="status">
            Round complete. Your practice is saved.
          </div>
        )}
      </div>
      {jump && (
        <button className="jump-to-live" onClick={scrollToLatest}>
          <ArrowDown size={14} />
          Jump to live
        </button>
      )}
      {canSend && (
        <footer className="conversation-composer">
          {voice.preview && run?.stage !== "challenge" && (
            <div className="preview-conversation-actions">
              <button
                className="text-button"
                onClick={() =>
                  openEvidence(
                    run?.grade?.sourceIds[0] ??
                      round.sections[run?.section ?? 0].sourceIds[0],
                  )
                }
              >
                View source
              </button>
              <Button
                variant="ghost"
                disabled={busy || voice.paused}
                onClick={() => void advancePreview().catch(() => {})}
              >
                {run?.stage === "questions"
                  ? "Complete round"
                  : run?.stage === "feedback"
                    ? "Your questions"
                    : run?.section === 2
                      ? "Try the challenge"
                      : "Continue"}
                <ArrowRight size={15} />
              </Button>
            </div>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit(typed).catch(() => {});
            }}
          >
            <input
              aria-label={
                run?.stage === "challenge"
                  ? "Your answer"
                  : "Question about this round"
              }
              placeholder={
                run?.stage === "challenge"
                  ? "Say your answer, or type it here…"
                  : "Speak naturally, or type a question…"
              }
              value={typed}
              maxLength={600}
              disabled={voice.paused}
              onChange={(event) => setTyped(event.target.value)}
            />
            <button
              className="icon-button"
              aria-label={
                run?.stage === "challenge" ? "Submit answer" : "Send question"
              }
              disabled={busy || voice.paused || !typed.trim()}
            >
              <Send size={17} />
            </button>
          </form>
        </footer>
      )}
    </aside>
  );
}
