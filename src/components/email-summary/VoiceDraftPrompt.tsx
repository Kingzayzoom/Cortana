"use client";
// Asks for the message aloud and transcribes it with the browser's own speech
// recognition, falling back to RecordedVoicePrompt where there is none.

import { useEffect, useRef, useState } from "react";
import { RecordedVoicePrompt } from "./RecordedVoicePrompt";

type RecognitionResult = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};
type RecognitionError = { error: string };
type BrowserRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionResult) => void) | null;
  onerror: ((event: RecognitionError) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionWindow = Window & {
  SpeechRecognition?: new () => BrowserRecognition;
  webkitSpeechRecognition?: new () => BrowserRecognition;
};

export function VoiceDraftPrompt({
  onMessage,
}: {
  onMessage: (message: string) => void;
}) {
  const recognitionRef = useRef<BrowserRecognition | null>(null);
  const promptRef = useRef<SpeechSynthesisUtterance | null>(null);
  const retryWithoutPrompt = useRef(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<"idle" | "asking" | "listening">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const browser = window as RecognitionWindow;
    setAvailable(
      Boolean(browser.SpeechRecognition || browser.webkitSpeechRecognition),
    );
    return () => {
      if (promptRef.current) {
        promptRef.current.onend = null;
        promptRef.current.onerror = null;
      }
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      }
    };
  }, []);

  function speakAndListen() {
    if (phase === "listening") {
      recognitionRef.current?.stop();
      return;
    }
    if (phase === "asking") return;
    const browser = window as RecognitionWindow;
    const Recognition =
      browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Recognition) {
      setError(
        "Voice input is unavailable in this browser. Type your message below instead.",
      );
      return;
    }
    setError(null);
    let recognition: BrowserRecognition;
    try {
      recognition = new Recognition();
    } catch {
      setError("Voice input could not start. Type your message below instead.");
      return;
    }
    recognitionRef.current = recognition;
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const message = event.results[0]?.[0]?.transcript?.trim();
      if (message) onMessage(message);
      else
        setError("I didn't catch that. Try again or type your message below.");
    };
    recognition.onerror = (event) => {
      retryWithoutPrompt.current = event.error === "not-allowed";
      setError(
        event.error === "not-allowed"
          ? "Microphone access was blocked. Allow access and tap Samantha again, or type below."
          : event.error === "no-speech"
            ? "I didn't catch that. Try again or type your message below."
            : "Voice input could not start. Type your message below instead.",
      );
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setPhase("idle");
    };
    let started = false;
    const listen = () => {
      if (started) return;
      started = true;
      promptRef.current = null;
      try {
        recognition.start();
        setPhase("listening");
      } catch {
        recognitionRef.current = null;
        setPhase("idle");
        setError(
          "Voice input could not start. Type your message below instead.",
        );
      }
    };
    if (
      retryWithoutPrompt.current ||
      !window.speechSynthesis ||
      typeof SpeechSynthesisUtterance === "undefined"
    ) {
      listen();
      return;
    }
    const prompt = new SpeechSynthesisUtterance(
      "What message would you like me to draft?",
    );
    promptRef.current = prompt;
    prompt.onend = listen;
    prompt.onerror = listen;
    setPhase("asking");
    try {
      window.speechSynthesis.speak(prompt);
    } catch {
      listen();
    }
  }

  if (available === false) return <RecordedVoicePrompt onMessage={onMessage} />;

  return (
    <div className="email-voice-prompt">
      <button
        type="button"
        className={`email-voice-button email-voice-button--${phase}`}
        onClick={speakAndListen}
        disabled={available !== true || phase === "asking"}
        aria-pressed={phase === "listening"}
        aria-label={
          phase === "listening"
            ? "Stop listening"
            : "Ask Samantha to draft by voice"
        }
      >
        <span className="email-voice-orb" aria-hidden="true" />
      </button>
      <div>
        <strong>Samantha voice draft</strong>
        <p aria-live="polite">
          {phase === "asking"
            ? "What message would you like me to draft?"
            : phase === "listening"
              ? "Listening… tap the icon to stop."
              : "Tap the icon and tell Samantha what to draft."}
        </p>
        {error && (
          <p className="email-voice-note" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
