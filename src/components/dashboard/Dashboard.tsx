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
export function Dashboard() {
  const { data, openEvidence } = useLearning(),
    voice = useVoice();
  const [transcriptOverride, setTranscriptOverride] = useState<boolean | null>(
    null,
  );
  const transcript =
    transcriptOverride ?? data?.preferences.transcript ?? false;
  const active =
    voice.preview || voice.connection === "connected" || data?.run?.completed;
  const stage = active ? data?.run?.stage : "ready";
  const current =
    stage === "briefing"
      ? 0
      : stage === "challenge" || stage === "feedback"
        ? 1
        : stage === "questions" || stage === "completed"
          ? 2
          : -1;
  return (
    <>
      <div className="dashboard-grid">
        <section className="hero-column" aria-labelledby="hero-heading">
          <div className="hero-intro">
            <p className="eyebrow">
              LISTEN <span>·</span> THINK <span>·</span> RESPOND <span>·</span>{" "}
              GROW
            </p>
            <h1 id="hero-heading">
              Your daily clinical
              <br />
              <span>conversation.</span>
            </h1>
            <p className="hero-subtitle">
              Two minutes to listen, think, and learn.
            </p>
          </div>
          <CortanaOrb />
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
                  title: "The brief",
                  description: "An evidence-based perspective",
                  icon: FileText,
                },
                {
                  title: "The challenge",
                  description: "One synthetic clinical case",
                  icon: UserRound,
                },
                {
                  title: "Your questions",
                  description: "Follow your curiosity",
                  icon: Lightbulb,
                },
              ].map((s, index) => (
                <li
                  key={s.title}
                  className={`${current === index ? "stage-active" : ""} ${current > index || stage === "completed" ? "stage-complete" : ""}`}
                  aria-current={current === index ? "step" : undefined}
                >
                  <span className="stage-number">
                    {current > index || stage === "completed" ? (
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
    </>
  );
}
