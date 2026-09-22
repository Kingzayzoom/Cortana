"use client";

import { useState } from "react";
import type { EmailDraft } from "@/lib/email-summary/types";
import { makeMockEmailDraft } from "@/lib/email-summary/mock-draft";
import { VoiceDraftPrompt } from "./VoiceDraftPrompt";

export function EmailDraftDemo() {
  const [request, setRequest] = useState("");
  const [recipient, setRecipient] = useState("");
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function makeDraft(message = request) {
    if (message.trim().length < 8) {
      setError(
        "Tell Samantha a little more about the message you want to draft.",
      );
      return;
    }
    setRequest(message);
    setDraft(makeMockEmailDraft(message, recipient));
    setCopied(false);
    setError(null);
  }

  async function copyDraft() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(
        `Subject: ${draft.subject}\n\n${draft.body}`,
      );
      setCopied(true);
      setError(null);
    } catch {
      setError(
        "Copying is unavailable here. Select the subject and message to copy them manually.",
      );
    }
  }

  return (
    <section className="email-draft-panel" aria-labelledby="email-draft-title">
      <div>
        <p className="eyebrow">VOICE DRAFT DEMO</p>
        <h2 id="email-draft-title">Ask Samantha to draft a message</h2>
        <p>
          Speak or type what you want to say. Samantha prepares an editable
          sample draft on this page. Nothing is sent or saved to Gmail.
        </p>
      </div>
      <VoiceDraftPrompt onMessage={makeDraft} />
      <form
        className="email-draft-form"
        onSubmit={(event) => {
          event.preventDefault();
          makeDraft();
        }}
      >
        <label htmlFor="email-draft-recipient">
          Who is it for? <span>(optional)</span>
        </label>
        <input
          id="email-draft-recipient"
          type="text"
          maxLength={120}
          placeholder="For example, clinic staff or a colleague"
          value={recipient}
          onChange={(event) => setRecipient(event.target.value)}
        />
        <label htmlFor="email-draft-request">Your message request</label>
        <textarea
          id="email-draft-request"
          rows={4}
          minLength={8}
          maxLength={1600}
          required
          placeholder="Tell the clinic staff I'm running 20 minutes late and will send an arrival update."
          value={request}
          onChange={(event) => setRequest(event.target.value)}
        />
        <button
          type="submit"
          className="primary-action"
          disabled={!request.trim()}
        >
          Create sample draft
        </button>
      </form>
      {error && (
        <p className="email-summary-error" role="alert">
          {error}
        </p>
      )}
      {draft && (
        <div
          className="email-draft-result"
          aria-label="Editable sample email draft"
        >
          <p className="email-draft-review">
            Sample draft ready. Review and edit it before using it anywhere.
          </p>
          <label htmlFor="email-draft-subject">Subject</label>
          <input
            id="email-draft-subject"
            type="text"
            maxLength={160}
            value={draft.subject}
            onChange={(event) => {
              setDraft({ ...draft, subject: event.target.value });
              setCopied(false);
            }}
          />
          <label htmlFor="email-draft-body">Message</label>
          <textarea
            id="email-draft-body"
            rows={9}
            maxLength={4000}
            value={draft.body}
            onChange={(event) => {
              setDraft({ ...draft, body: event.target.value });
              setCopied(false);
            }}
          />
          <button
            type="button"
            className="secondary-action"
            onClick={() => void copyDraft()}
          >
            {copied ? "Copied" : "Copy sample draft"}
          </button>
        </div>
      )}
    </section>
  );
}
