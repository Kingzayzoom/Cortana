"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "asking" | "listening" | "transcribing";

export function RecordedVoicePrompt({ onMessage }: { onMessage: (message: string) => void }) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const promptRef = useRef<SpeechSynthesisUtterance | null>(null);
  const promptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  function releaseMicrophone() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  useEffect(() => {
    mountedRef.current = true;
    setAvailable(Boolean(navigator.mediaDevices && typeof MediaRecorder !== "undefined"));
    return () => {
      mountedRef.current = false;
      if (promptRef.current) {
        promptRef.current.onend = null;
        promptRef.current.onerror = null;
        window.speechSynthesis?.cancel();
      }
      if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
      if (recorderRef.current) {
        recorderRef.current.ondataavailable = null;
        recorderRef.current.onerror = null;
        recorderRef.current.onstop = null;
        if (recorderRef.current.state !== "inactive") recorderRef.current.stop();
      }
      releaseMicrophone();
    };
  }, []);

  async function transcribe(audio: Blob) {
    setPhase("transcribing");
    try {
      const form = new FormData();
      form.append("audio", audio, "voice-message");
      const response = await fetch("/api/email-summary/transcribe", { method: "POST", body: form });
      const result = await response.json() as { text?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Voice transcription failed. Try again or type below.");
      const message = result.text?.trim();
      if (!message) throw new Error("I didn't catch that. Try again or type your message below.");
      if (mountedRef.current) onMessage(message);
      if (mountedRef.current) setError(null);
    } catch (cause) {
      if (mountedRef.current) setError(cause instanceof Error ? cause.message : "Voice input failed. Type your message below.");
    } finally {
      if (mountedRef.current) setPhase("idle");
    }
  }

  async function record() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => {
        recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
        recorderRef.current = null;
        releaseMicrophone();
        setPhase("idle");
        setError("Microphone recording failed. Try again or type your message below.");
      };
      recorder.onstop = () => {
        const audio = new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || "audio/ogg" });
        recorderRef.current = null;
        releaseMicrophone();
        if (!mountedRef.current) return;
        if (audio.size < 500) {
          setPhase("idle");
          setError("I didn't catch that. Try again or type your message below.");
          return;
        }
        void transcribe(audio);
      };
      recorder.start();
      setPhase("listening");
      timerRef.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 20_000);
    } catch (cause) {
      releaseMicrophone();
      setPhase("idle");
      setError(cause instanceof DOMException && cause.name === "NotAllowedError"
        ? "Allow microphone access in Firefox and try again, or type below."
        : "The microphone could not start. Check its permissions or type below.");
    }
  }

  function speakAndRecord() {
    if (phase === "listening") {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      return;
    }
    if (phase !== "idle" || !available) return;
    setError(null);
    let started = false;
    const listen = () => {
      if (started || !mountedRef.current) return;
      started = true;
      if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
      promptTimerRef.current = null;
      promptRef.current = null;
      void record();
    };
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") {
      listen();
      return;
    }
    const prompt = new SpeechSynthesisUtterance("What message would you like me to draft?");
    promptRef.current = prompt;
    prompt.onend = listen;
    prompt.onerror = listen;
    setPhase("asking");
    try {
      window.speechSynthesis.speak(prompt);
      promptTimerRef.current = setTimeout(listen, 8_000);
    } catch {
      listen();
    }
  }

  return <div className="email-voice-prompt">
    <button type="button" className={`email-voice-button email-voice-button--${phase}`}
      onClick={speakAndRecord} disabled={!available || phase === "asking" || phase === "transcribing"}
      aria-pressed={phase === "listening"}
      aria-label={phase === "listening" ? "Stop listening" : "Ask Cortana to draft by voice"}>
      <span className="email-voice-orb" aria-hidden="true" />
    </button>
    <div>
      <strong>Cortana voice draft</strong>
      <p aria-live="polite">{phase === "asking" ? "What message would you like me to draft?"
        : phase === "listening" ? "Listening… tap the icon when you finish."
          : phase === "transcribing" ? "Transcribing your message…"
            : "Tap the icon and tell Cortana what to draft."}</p>
      {available && <p className="email-voice-note">
        This browser sends a short recording to Gemini for transcription. Cortana does not save the audio or create a Gmail draft.
      </p>}
      {available === false && <p className="email-voice-note">
        Voice input needs a microphone and a secure page (HTTPS or localhost). You can type your request below.
      </p>}
      {error && <p className="email-voice-note" role="alert">{error}</p>}
    </div>
  </div>;
}
