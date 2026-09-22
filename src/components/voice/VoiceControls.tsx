"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Play,
  Mic,
  MicOff,
  Pause,
  Square,
  MessageSquare,
  Headphones,
  ShieldCheck,
  Languages,
} from "lucide-react";
import { useVoice } from "@/lib/voice/provider";
import { useLearning } from "@/lib/learning/provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SPOKEN_LANGUAGES, spokenLanguage } from "@/lib/voice/languages";
export function VoiceStatus() {
  const voice = useVoice();
  let text = "Ready when you are.";
  let state = "idle";
  if (voice.connection === "error") {
    text = "Voice needs your attention.";
    state = "error";
  } else if (voice.connection === "connecting") {
    text = "Connecting…";
    state = "connecting";
  } else if (voice.connection === "disconnecting")
    text = "Ending the voice session…";
  else if (voice.paused) {
    text = "Round paused — microphone off.";
    state = "paused";
  } else if (voice.preview) {
    text = "Local preview · microphone off";
    state = "preview";
  } else if (voice.connection === "connected") {
    state = "live";
    if (voice.activity === "assistant-speaking")
      text = voice.muted
        ? "Cortana is speaking · microphone off"
        : "Cortana is speaking";
    else if (voice.muted) text = "Microphone off.";
    else if (voice.activity === "awaiting-response")
      text = "Working on your response…";
    else if (voice.activity === "user-speaking") text = "Listening to you…";
    else text = "Your turn. I’m listening.";
  }
  return (
    <div
      className={`voice-status status-${state}`}
      role="status"
      data-conversation-id={voice.conversationId ?? undefined}
    >
      <span className="status-dot" />
      {text}
    </div>
  );
}
export function LanguagePicker() {
  const { data, busy } = useLearning();
  const voice = useVoice();
  return (
    <div className="language-picker">
      <label htmlFor="round-language">
        <Languages size={13} />
        Voice language
      </label>
      <select
        id="round-language"
        value={voice.language}
        disabled={
          !data || busy || voice.working || voice.connection === "connected"
        }
        title={
          voice.connection === "connected"
            ? "End this round to choose the language for your next conversation."
            : undefined
        }
        onChange={(event) =>
          voice.setLanguage(spokenLanguage(event.target.value))
        }
      >
        {SPOKEN_LANGUAGES.map((language) => (
          <option key={language.code} value={language.code}>
            {language.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function VoiceControls({
  transcript,
  onTranscript,
  showTranscriptToggle = true,
}: {
  transcript: boolean;
  onTranscript: () => void;
  showTranscriptToggle?: boolean;
}) {
  const voice = useVoice(),
    { data, busy } = useLearning();
  const active = voice.connection === "connected" || voice.preview;
  return (
    <div className="voice-controls">
      <VoiceStatus />
      {voice.paused ? (
        <div className="active-controls">
          <Button
            onClick={
              voice.preview
                ? voice.startPreview
                : () => voice.requestStart(voice.briefing ? "context" : "round")
            }
            disabled={voice.working}
          >
            <Play size={16} fill="currentColor" />
            {voice.connection === "error"
              ? "Retry voice"
              : "Resume this section"}
          </Button>
          <Button variant="ghost" onClick={voice.end}>
            End round
          </Button>
        </div>
      ) : active ? (
        <div className="active-controls">
          {!voice.preview && (
            <button
              className={`icon-button control-mic ${voice.muted ? "is-muted" : ""}`}
              aria-label={
                voice.muted ? "Turn microphone on" : "Mute microphone"
              }
              aria-pressed={voice.muted}
              onClick={voice.mute}
            >
              {voice.muted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          )}
          {voice.preview && (
            <Button variant="secondary" onClick={voice.pause}>
              <Pause size={17} />
              Pause round
            </Button>
          )}
          <button
            className="icon-button control-end"
            aria-label="End round"
            onClick={voice.end}
          >
            <Square size={17} fill="currentColor" />
          </button>
        </div>
      ) : (
        <>
          <Button
            className="start-button"
            onClick={() => voice.requestStart()}
            disabled={!data || busy || voice.working}
          >
            <Play size={17} fill="currentColor" />
            {voice.connection === "disconnecting"
              ? "Ending session…"
              : voice.working
                ? "Connecting…"
                : "Start today’s round"}
            <ArrowRight size={19} />
          </Button>
          <button
            className="text-button preview-link"
            onClick={voice.startPreview}
            disabled={!data || busy || voice.working}
          >
            Explore in text mode
            <ArrowRight size={14} />
          </button>
        </>
      )}
      <LanguagePicker />
      {active && showTranscriptToggle && (
        <>
          <button
            className="text-button transcript-toggle"
            aria-expanded={transcript}
            onClick={onTranscript}
          >
            <MessageSquare size={15} />
            {transcript ? "Hide" : "Show"}{" "}
            {voice.preview ? "preview conversation" : "transcript"}
          </button>
        </>
      )}
      {active && !voice.preview && (
        <span className="interruption-hint">
          You can interrupt naturally with a question.
        </span>
      )}
      {voice.working && !active && (
        <Button variant="ghost" onClick={voice.end}>
          Cancel connection
        </Button>
      )}
      {voice.error && (
        <p className="inline-error" role="alert">
          {voice.error}
        </p>
      )}
    </div>
  );
}
export function VoiceConsent() {
  const voice = useVoice(),
    { data } = useLearning();
  const [code, setCode] = useState("");
  return (
    <Dialog
      open={voice.consentOpen}
      onOpenChange={(open) => {
        if (!open && !voice.working) voice.closeConsent();
      }}
      title="A conversation with Cortana"
      description="A little space to listen, think, and ask."
    >
      <div className="consent-symbol">
        <Headphones size={29} />
      </div>
      <p className="consent-copy">
        This is an AI voice session. Your microphone audio is sent to ElevenLabs
        to make the conversation possible. Please use synthetic examples and
        keep real patient information out of the conversation.
      </p>
      <p className="small muted">
        <ShieldCheck size={16} className="inline-icon" />
        Cortana does not save raw audio. Provider retention depends on your
        ElevenLabs account settings.
      </p>
      {!data?.voiceConfigured ? (
        <div className="config-notice">
          <strong>Voice connection not configured.</strong>
          <p>
            {voice.briefing
              ? "A factual briefing preview is available in Context Feed."
              : "The complete learning round is available as a local text preview."}
          </p>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void voice.start(code);
          }}
        >
          <label className="field-label" htmlFor="access-code">
            Demo access code
          </label>
          <input
            id="access-code"
            type="password"
            autoComplete="off"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
            className="input"
            placeholder="Enter your private demo code"
          />
          <Button
            className="full-width"
            type="submit"
            disabled={!code || voice.working}
          >
            {voice.working
              ? "Connecting…"
              : voice.error
                ? "Retry voice"
                : "Agree & start voice"}
            <Mic size={17} />
          </Button>
        </form>
      )}
      {voice.error && (
        <p className="inline-error" role="alert">
          {voice.error}
        </p>
      )}
      {voice.prime ? (
        <Button variant="secondary" onClick={voice.closeConsent}>
          Continue Prime on screen
        </Button>
      ) : voice.briefing ? (
        <Button asChild variant="secondary">
          <Link href="/context" onClick={voice.closeConsent}>
            Return to briefing preview
          </Link>
        </Button>
      ) : (
        <Button
          className="full-width"
          variant={data?.voiceConfigured ? "secondary" : "primary"}
          onClick={voice.startPreview}
          disabled={voice.working}
        >
          Open local preview
          <ArrowRight size={17} />
        </Button>
      )}
      {voice.working && (
        <Button variant="ghost" onClick={voice.end}>
          Cancel connection
        </Button>
      )}
      <p className="small muted centered">
        No microphone access is requested in local preview.
      </p>
    </Dialog>
  );
}
