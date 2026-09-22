"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { CortanaOrb } from "@/components/voice/CortanaOrb";
import { LiveConversationPanel } from "@/components/voice/LiveConversationPanel";
import { TranscriptPanel } from "@/components/voice/TranscriptPanel";
import { VoiceControls } from "@/components/voice/VoiceControls";
import { LessonPanel } from "@/components/learning/LessonPanel";
import { ContextFeedCard } from "@/components/context/ContextFeedView";
import { DailyPrimeCard } from "@/components/prime/PrimeViews";
import { useLearning } from "@/lib/learning/provider";
import { useVoice } from "@/lib/voice/provider";

export function Dashboard() {
  const { data } = useLearning();
  const voice = useVoice();
  const [transcriptOverride, setTranscriptOverride] = useState<boolean | null>(
    null,
  );
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
  useEffect(() => {
    if (liveMode) window.scrollTo({ top: 0, behavior: "instant" });
  }, [liveMode]);
  useEffect(() => {
    if (showSummary && voice.connection === "connected") voice.end();
  }, [showSummary, voice]);

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
                <span>
                  {liveMode
                    ? voice.briefing
                      ? "Synthetic context briefing"
                      : "Heart failure, beyond diabetes"
                    : ""}
                </span>
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
              <DailyPrimeCard />
            </div>
          </div>
        </>
      )}
    </>
  );
}
