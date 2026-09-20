"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  FileText,
  HeartPulse,
  Lightbulb,
  UserRound,
} from "lucide-react";
import { CortanaOrb } from "@/components/voice/CortanaOrb";
import { LiveConversationPanel } from "@/components/voice/LiveConversationPanel";
import { TranscriptPanel } from "@/components/voice/TranscriptPanel";
import { VoiceControls } from "@/components/voice/VoiceControls";
import { LessonPanel } from "@/components/learning/LessonPanel";
import { ProgressCards } from "./ProgressCards";
import { ContextFeedCard } from "@/components/context/ContextFeedView";
import { useLearning } from "@/lib/learning/provider";
import { useVoice } from "@/lib/voice/provider";
import { Dialog } from "@/components/ui/dialog";
import { selectNextRound } from "@/lib/adaptive-learning/selectNextRound";

export function Dashboard() {
  const { data, openEvidence } = useLearning();
  const voice = useVoice();
  const [transcriptOverride, setTranscriptOverride] = useState<boolean | null>(
    null,
  );
  const [whyOpen, setWhyOpen] = useState(false);
  const [summaryReady, setSummaryReady] = useState<string | null>(null);
  const [dismissedSummary, setDismissedSummary] = useState<string | null>(null);
  const [participated, setParticipated] = useState(false);
  const [enteredPreview, setEnteredPreview] = useState(false);
  useEffect(() => {
    if (voice.preview && !voice.paused) setEnteredPreview(true);
    else if (!voice.preview) setEnteredPreview(false);
  }, [voice.preview, voice.paused]);
  useEffect(() => {
    if (voice.connection === "connected" || (voice.preview && !voice.paused))
      setParticipated(true);
  }, [voice.connection, voice.preview, voice.paused]);
  useEffect(() => {
    if (!data?.run?.completed) return;
    const id = data.run.id;
    const timer = setTimeout(
      () => setSummaryReady(id),
      participated ? 1600 : 0,
    );
    return () => clearTimeout(timer);
  }, [data?.run?.completed, data?.run?.id, participated]);
  const completionMoment = Boolean(
    data?.run?.completed && summaryReady !== data.run.id && participated,
  );
  const showSummary = Boolean(
    data?.run?.completed &&
    !completionMoment &&
    dismissedSummary !== data.run.id,
  );
  const recommendation = selectNextRound(data?.learningSignals ?? []);
  const transcript =
    transcriptOverride ?? data?.preferences.transcript ?? false;
  const liveMode = Boolean(
    completionMoment ||
    (!data?.run?.completed &&
      (voice.consentOpen ||
        voice.working ||
        (voice.preview && (enteredPreview || !voice.paused)) ||
        ["connecting", "connected", "disconnecting"].includes(
          voice.connection,
        ))),
  );
  const active = liveMode || data?.run?.completed;
  useEffect(() => {
    if (liveMode) window.scrollTo({ top: 0, behavior: "instant" });
  }, [liveMode]);
  useEffect(() => {
    if (showSummary && voice.connection === "connected") voice.end();
  }, [showSummary, voice]);
  const stage = active ? data?.run?.stage : "ready";
  const sessionSignals =
    data?.learningSignals?.filter(
      (event) => event.sessionId === data.run?.id,
    ) ?? [];
  const finishedStages = [
    sessionSignals.some((event) => event.type === "briefing_completed"),
    sessionSignals.some((event) => event.type === "question_asked"),
    Boolean(data?.run?.grade),
    Boolean(data?.run?.completed),
  ];
  const current =
    stage === "briefing"
      ? 0
      : stage === "challenge" || stage === "feedback"
        ? 2
        : stage === "questions" || stage === "completed"
          ? stage === "completed"
            ? 3
            : 1
          : -1;

  return (
    <>
      {showSummary ? (
        <section
          className="completion-scene"
          aria-labelledby="completion-heading"
        >
          <div className="completion-scene-heading">
            <p className="eyebrow">ROUND COMPLETE · PRACTICE SAVED</p>
            <h1 id="completion-heading">Your learning summary.</h1>
            <p>
              The conversation has ended. Review the signal that was saved and
              when Cortana suggests returning to it.
            </p>
          </div>
          <LessonPanel />
          <button
            className="text-button return-dashboard"
            onClick={() => {
              setDismissedSummary(data!.run!.id);
              voice.end();
            }}
          >
            Return to dashboard <ArrowRight size={16} />
          </button>
        </section>
      ) : (
        <>
          <div
            className={`dashboard-grid${liveMode ? " live-mode" : ""}`}
            data-conversation-mode={liveMode ? "live" : "dashboard"}
            data-reduced-motion={data?.preferences.reducedMotion || undefined}
          >
            <section
              className="hero-column"
              aria-labelledby={liveMode ? "live-round-heading" : "hero-heading"}
            >
              <div className="hero-intro" aria-hidden={liveMode}>
                <p className="eyebrow">
                  LISTEN <span>·</span> ASK <span>·</span> PRACTICE{" "}
                  <span>·</span> REINFORCE
                </p>
                <h1 id="hero-heading">
                  Your daily clinical
                  <br />
                  <span>conversation.</span>
                </h1>
                <p className="hero-subtitle">
                  Listen. Ask. Practice. Reinforce.
                </p>
              </div>

              <div className="live-orb-heading" aria-hidden={!liveMode}>
                <p>
                  <span className="live-presence-dot" />
                  {voice.preview ? "TEXT PREVIEW" : "LIVE CONVERSATION"}
                </p>
                <h1 id="live-round-heading">
                  {liveMode ? "In conversation." : ""}
                </h1>
                <span>{liveMode ? voice.briefing ? "Synthetic context briefing" : "Heart failure, beyond diabetes" : ""}</span>
              </div>

              <CortanaOrb />

              <p className="orb-learning-caption" aria-hidden={liveMode}>
                2-minute round · Cardiology
                <br />
                <span>Evidence-grounded · Interactive · Synthetic case</span>
              </p>
              <VoiceControls
                transcript={transcript}
                onTranscript={() => setTranscriptOverride(!transcript)}
                showTranscriptToggle={!liveMode}
              />
              {transcript && (
                <div
                  className="idle-transcript-shell"
                  aria-hidden={liveMode}
                  inert={liveMode ? true : undefined}
                >
                  <TranscriptPanel />
                </div>
              )}
            </section>

            <aside
              className="round-column dashboard-round-column"
              aria-hidden={liveMode}
              inert={liveMode ? true : undefined}
            >
              <section className="round-card panel">
                <div className="round-title">
                  <h2>Today’s Round</h2>
                  <span className="round-count">01</span>
                </div>
                <p className="round-duration">
                  <Clock3 size={15} />
                  About 2 minutes <span>·</span> Cardiology
                </p>
                <ol className="round-stages">
                  {[
                    {
                      title: "Briefing",
                      description: "An evidence-based perspective",
                      icon: FileText,
                    },
                    {
                      title: "Ask anything",
                      description: "Follow a question at any point",
                      icon: Lightbulb,
                    },
                    {
                      title: "Clinical challenge",
                      description: "One synthetic clinical case",
                      icon: UserRound,
                    },
                    {
                      title: "Reinforcement",
                      description: "Practice with a reason to revisit",
                      icon: Lightbulb,
                    },
                  ].map((item, index) => (
                    <li
                      key={item.title}
                      className={`${current === index ? "stage-active" : ""} ${finishedStages[index] ? "stage-complete" : ""}`}
                      aria-current={current === index ? "step" : undefined}
                    >
                      <span className="stage-number">
                        {finishedStages[index] ? (
                          <Check size={15} />
                        ) : (
                          `0${index + 1}`
                        )}
                      </span>
                      <item.icon size={21} strokeWidth={1.6} />
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.description}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="round-focus">
                  <p className="focus-label">TODAY&apos;S FOCUS</p>
                  <button
                    className="focus-topic"
                    onClick={() => openEvidence("dapa-hf")}
                  >
                    <span className="focus-icon">
                      <HeartPulse size={26} strokeWidth={1.55} />
                    </span>
                    <span>
                      <strong>Heart failure</strong>
                      <small>Beyond diabetes. Into the evidence.</small>
                    </span>
                    <ArrowRight size={17} />
                  </button>
                  <p className="focus-description">
                    Explore who was studied in DAPA-HF, and why that distinction
                    matters.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setWhyOpen(true)}
                  >
                    Why this round?
                  </button>
                  <button
                    className="text-button round-source-link"
                    onClick={() => openEvidence("dapa-hf")}
                  >
                    <BookOpen size={15} />
                    View round sources
                    <ArrowRight size={15} />
                  </button>
                </div>
              </section>
              <div className="daily-note">
                <span className="note-line" />
                <p>
                  Make room for
                  <br />
                  <em>a little more knowing.</em>
                </p>
              </div>
            </aside>

            <LiveConversationPanel
              key={data?.run?.id ?? "starting"}
              active={liveMode}
            />
          </div>

          <div
            className={`dashboard-lower-shell${liveMode ? " is-cleared" : ""}`}
            aria-hidden={liveMode}
            inert={liveMode ? true : undefined}
          >
            <div className="dashboard-lower-inner">
              <ContextFeedCard />
              <ProgressCards />
            </div>
          </div>
        </>
      )}

      <Dialog
        open={whyOpen}
        onOpenChange={setWhyOpen}
        title="Why this round?"
        description="A transparent recommendation from your learning activity."
      >
        <p>{recommendation?.reason}</p>
        <p className="small muted">
          The current demo supports one reviewed DAPA-HF round. It does not
          infer clinical ability or select unsupported topics.
        </p>
      </Dialog>
    </>
  );
}
