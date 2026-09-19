"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  Activity,
  BookOpen,
  Check,
  Circle,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import { useLearning } from "@/lib/learning/provider";
import { useVoice } from "@/lib/voice/provider";
import { round, sourceById } from "@/lib/content/round";

type Step = {
  label: string;
  detail: string;
};

const steps: Step[] = [
  { label: "Trial population", detail: "Who was studied" },
  { label: "Evidence discussion", detail: "Finding and limits" },
  { label: "Clinical challenge", detail: "Apply the distinction" },
  { label: "Evidence review", detail: "Ground the feedback" },
  { label: "Questions & wrap", detail: "Make it your own" },
];

function getStep(stage: string | undefined, section: number | undefined) {
  if (stage === "briefing") return section === 0 ? 0 : 1;
  if (stage === "challenge") return 2;
  if (stage === "feedback") return 3;
  if (stage === "questions" || stage === "completed") return 4;
  return 0;
}

function getSessionState(
  connection: string,
  activity: string,
  preview: boolean,
  paused: boolean,
  consentOpen: boolean,
) {
  if (paused) return { id: "paused", label: "Round paused" };
  if (consentOpen && connection === "idle")
    return { id: "entering", label: "Ready to connect" };
  if (connection === "connecting")
    return { id: "connecting", label: "Opening the conversation" };
  if (connection === "disconnecting")
    return { id: "ending", label: "Closing the conversation" };
  if (preview) return { id: "preview", label: "Text preview in progress" };
  if (activity === "assistant-speaking")
    return { id: "assistant-speaking", label: "Cortana is speaking" };
  if (activity === "user-speaking")
    return { id: "user-speaking", label: "Listening to you" };
  if (activity === "awaiting-response")
    return { id: "between-turns", label: "Cortana is thinking" };
  return { id: "listening", label: "Your turn" };
}

export function LiveConversationPanel({
  active,
  children,
}: {
  active: boolean;
  children?: ReactNode;
}) {
  const { data, openEvidence } = useLearning();
  const voice = useVoice();
  const transcript = useRef<HTMLDivElement>(null);
  const run = data?.run;
  const currentStep = getStep(run?.stage, run?.section);
  const section = round.sections[run?.section ?? 0] ?? round.sections[0];
  const state = getSessionState(
    voice.connection,
    voice.activity,
    voice.preview,
    voice.paused,
    voice.consentOpen,
  );

  const focus = useMemo(() => {
    if (run?.stage === "challenge") {
      return {
        eyebrow: "Clinical challenge",
        title: "Apply the trial distinction",
        text: round.case.question,
        sourceId: "dapa-hf",
      };
    }
    if (run?.stage === "feedback") {
      return {
        eyebrow: "Evidence-grounded feedback",
        title:
          run.grade?.verdict === "correct"
            ? "The population distinction"
            : "Revisit the population",
        text:
          run.grade?.takeaway ??
          "Keep the population and scope of the evidence in view.",
        sourceId: run.grade?.sourceIds[0] ?? "dapa-hf",
      };
    }
    if (run?.stage === "questions") {
      return {
        eyebrow: "Questions & wrap",
        title: "Make the evidence your own",
        text: "Ask one final question about this round, or complete your practice.",
        sourceId: "dapa-diabetes",
      };
    }
    return {
      eyebrow: `The brief · Section ${(run?.section ?? 0) + 1} of 3`,
      title: section.title,
      text:
        run?.section === 0
          ? "Symptomatic HFrEF with LVEF ≤40%; diabetes was not required."
          : run?.section === 1
            ? "The primary outcome combined worsening heart failure and cardiovascular death."
            : "Keep the selected trial population and exploratory subgroup limits in view.",
      sourceId: section.sourceIds[0],
    };
  }, [run?.grade, run?.section, run?.stage, section]);
  const source = sourceById(focus.sourceId);

  useEffect(() => {
    if (!active || !transcript.current) return;
    transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [active, voice.messages]);

  return (
    <aside
      className="live-intelligence-panel"
      aria-label="Live round intelligence"
      aria-hidden={!active}
      inert={!active ? true : undefined}
      data-session-state={state.id}
    >
      <header className="live-panel-header">
        <div>
          <p className="live-panel-kicker">TODAY&apos;S ROUND</p>
          <h2>{round.title}</h2>
          <p>{round.duration} · Cardiology</p>
        </div>
        <span className="live-round-number">01</span>
      </header>

      <section className="live-progress" aria-label="Round progress">
        <div className="live-section-label">
          <span>Round progress</span>
          <span>
            Step {currentStep + 1} of {steps.length}
          </span>
        </div>
        <ol>
          {steps.map((step, index) => (
            <li
              key={step.label}
              className={
                index < currentStep
                  ? "is-complete"
                  : index === currentStep
                    ? "is-current"
                    : ""
              }
              aria-current={index === currentStep ? "step" : undefined}
            >
              <span className="live-step-marker">
                {index < currentStep ? (
                  <Check size={12} aria-hidden="true" />
                ) : (
                  <Circle size={9} aria-hidden="true" />
                )}
              </span>
              <span>
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="live-focus" aria-labelledby="live-focus-heading">
        <div className="live-focus-icon" aria-hidden="true">
          <Sparkles size={17} />
        </div>
        <div>
          <p>{focus.eyebrow}</p>
          <h3 id="live-focus-heading">Current focus</h3>
          <strong className="live-focus-title">{focus.title}</strong>
          <blockquote>{focus.text}</blockquote>
          {source && (
            <button
              className="text-button live-source-link"
              onClick={() => openEvidence(source.id)}
            >
              <BookOpen size={14} />
              {source.shortTitle}
            </button>
          )}
        </div>
      </section>

      <section
        className="live-transcript-section"
        aria-labelledby="live-transcript-heading"
      >
        <div className="live-transcript-heading">
          <div>
            <MessageSquareText size={16} aria-hidden="true" />
            <h3 id="live-transcript-heading">Live transcript</h3>
          </div>
          <span>{voice.messages.length} turns</span>
        </div>
        <div
          className="live-transcript"
          ref={transcript}
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          aria-label="Conversation between you and Cortana"
        >
          {voice.messages.length === 0 ? (
            <div className="live-transcript-empty">
              <span className="transcript-pulse" aria-hidden="true" />
              <p>
                {state.id === "entering" || state.id === "connecting"
                  ? "Your conversation will appear here as soon as the round begins."
                  : "Cortana is ready. Your conversation will appear here turn by turn."}
              </p>
            </div>
          ) : (
            voice.messages.map((message) => (
              <article
                key={message.id}
                className={`live-transcript-turn live-turn-${message.role}`}
              >
                <span>
                  {message.role === "user" ? "You" : "Cortana"}
                  {message.preview && message.role === "assistant"
                    ? " · local preview"
                    : ""}
                </span>
                <p>{message.text}</p>
              </article>
            ))
          )}
        </div>
        <div className="live-response-state" role="status">
          <span className="live-response-icon" aria-hidden="true">
            <Activity size={14} />
          </span>
          <span>{state.label}</span>
        </div>
      </section>

      {children && <div className="live-lesson-slot">{children}</div>}
    </aside>
  );
}
