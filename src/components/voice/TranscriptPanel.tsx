"use client";
// The optional text transcript of the conversation.
import { useEffect, useRef } from "react";
import { useVoice } from "@/lib/voice/provider";
export function TranscriptPanel() {
  const { messages } = useVoice();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (panel.current) panel.current.scrollTop = panel.current.scrollHeight;
  }, [messages]);
  return (
    <div
      className="transcript-panel"
      ref={panel}
      aria-label="Conversation transcript"
      role="log"
      aria-live="polite"
    >
      {messages.length === 0 ? (
        <p className="muted small">
          Your conversation will appear here. Transcripts stay in this tab.
        </p>
      ) : (
        messages.map((message) => (
          <div
            key={message.id}
            className={`transcript-message message-${message.role}`}
          >
            <span>
              {message.role === "user"
                ? "User"
                : message.preview
                  ? "Samantha · local preview"
                  : "Samantha"}
            </span>
            <p>{message.text}</p>
          </div>
        ))
      )}
    </div>
  );
}
