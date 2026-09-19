"use client";
import { useState } from "react";
import {
  Clock3,
  FileText,
  Lightbulb,
  UserRound,
  HeartPulse,
  ArrowRight,
  BookOpen,
  Check,
} from "lucide-react";
import { CortanaOrb } from "@/components/voice/CortanaOrb";
import { VoiceControls } from "@/components/voice/VoiceControls";
import { TranscriptPanel } from "@/components/voice/TranscriptPanel";
import { LessonPanel } from "@/components/learning/LessonPanel";
import { ProgressCards } from "./ProgressCards";
import { useLearning } from "@/lib/learning/provider";
import { useVoice } from "@/lib/voice/provider";
import { Dialog } from "@/components/ui/dialog";
import { selectNextRound } from "@/lib/adaptive-learning/selectNextRound";
export function Dashboard() {
  const { data, openEvidence } = useLearning(),
    voice = useVoice();
  const [transcriptOverride, setTranscriptOverride] = useState<boolean | null>(
    null,
  );
  const [whyOpen, setWhyOpen] = useState(false);
  const recommendation = selectNextRound(data?.learningSignals ?? []);
  const transcript =
    transcriptOverride ?? data?.preferences.transcript ?? false;
  const active =
    voice.preview || voice.connection === "connected" || data?.run?.completed;
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
      <div className="dashboard-grid">
        <section className="hero-column" aria-labelledby="hero-heading">
          <div className="hero-intro">
            <p className="eyebrow">
              LISTEN <span>·</span> ASK <span>·</span> PRACTICE <span>·</span>{" "}
              REINFORCE
            </p>
            <h1 id="hero-heading">
              Your daily clinical
              <br />
              <span>conversation.</span>
            </h1>
            <p className="hero-subtitle">Listen. Ask. Practice. Reinforce.</p>
          </div>
          <CortanaOrb />
          <p className="orb-learning-caption">
            2-minute round · Cardiology
            <br />
            <span>Evidence-grounded · Interactive · Synthetic case</span>
          </p>
          <VoiceControls
            transcript={transcript}
            onTranscript={() => setTranscriptOverride(!transcript)}
          />
          {transcript && <TranscriptPanel />}
        </section>
        <aside className="round-column">
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
              ].map((s, index) => (
                <li
                  key={s.title}
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
                  <s.icon size={21} strokeWidth={1.6} />
                  <div>
                    <strong>{s.title}</strong>
                    <p>{s.description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="round-focus">
              <p className="focus-label">TODAY’S FOCUS</p>
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
              <button className="text-button" onClick={() => setWhyOpen(true)}>
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
      </div>
      <LessonPanel />
      <ProgressCards />
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
