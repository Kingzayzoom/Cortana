"use client";
// /email-summary: connect Gmail, read the morning briefing, refresh it, or
// disconnect. OAuth errors arrive as ?email_error= codes and are explained here.

import { useCallback, useEffect, useState } from "react";
import type { EmailSummaryStatus } from "@/lib/email-summary/types";
import { EmailDraftDemo } from "./EmailDraftDemo";

const errors: Record<string, string> = {
  denied: "Gmail access was not granted.",
  expired: "The Gmail connection attempt expired. Please try again.",
  failed: "Gmail could not be connected. Check the OAuth setup and try again.",
  config: "Email Summary is not fully configured on this server.",
  google_unreachable:
    "The server could not reach Google to finish Gmail sign-in. Check its internet access and try again.",
  google_rejected:
    "Google rejected the Gmail token exchange. Check that the client ID and secret belong to the OAuth client that has /api/auth/google/callback registered.",
  google_response:
    "Google did not grant all requested Gmail permissions. Try connecting again.",
  gmail_unreachable:
    "The server could not reach the Gmail API. Check its internet access and try again.",
  gmail_denied:
    "Google accepted sign-in, but Gmail API access was denied. Enable Gmail API in the OAuth project and check this account's Gmail access.",
  gmail_response:
    "The Gmail API returned an invalid account profile. Try connecting again.",
  storage:
    "Google authorized Gmail, but the connection could not be saved to Supabase. Check the Email Summary database setup.",
};

async function readStatus(response: Response): Promise<EmailSummaryStatus> {
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "Email Summary could not be loaded.");
  return data as EmailSummaryStatus;
}

export function EmailSummaryFeature() {
  const [status, setStatus] = useState<EmailSummaryStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set on the return from Google, so the first briefing is built right away
  // instead of waiting for the morning cron.
  const [firstBriefing, setFirstBriefing] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("email_error");
    if (oauthError) setError(errors[oauthError] ?? errors.failed);
    if (params.has("email_connected")) setFirstBriefing(true);
    if (oauthError || params.has("email_connected")) {
      window.history.replaceState(null, "", "/email-summary");
    }
    let active = true;
    void fetch("/api/email-summary", { cache: "no-store" })
      .then(readStatus)
      .then((data) => {
        if (active) setStatus(data);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Email Summary could not be loaded.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setStatus(
        await readStatus(
          await fetch("/api/email-summary/refresh", {
            method: "POST",
            cache: "no-store",
          }),
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The briefing could not be refreshed.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!firstBriefing || !status) return;
    setFirstBriefing(false);
    if (status.connected && !status.summary) void refresh();
  }, [firstBriefing, status, refresh]);

  async function disconnect() {
    if (!window.confirm("Disconnect Gmail and remove saved email briefings?"))
      return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/email-summary/disconnect", {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Gmail could not be disconnected.");
      }
      setStatus({
        connected: false,
        emailAddress: null,
        summary: null,
        schedule: "Daily morning Eastern",
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Gmail could not be disconnected.",
      );
    } finally {
      setBusy(false);
    }
  }

  const summary = status?.summary;
  return (
    <section
      className="email-summary-page"
      aria-labelledby="email-summary-title"
    >
      <div className="feature-header">
        <div>
          <p className="eyebrow">OPTIONAL FEATURE</p>
          <h1 id="email-summary-title">Daily Email Summary</h1>
        </div>
      </div>

      {error && (
        <p className="email-summary-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <div className="feature-empty-state">
          <p>Loading your Gmail briefing…</p>
        </div>
      ) : !status?.connected ? (
        <div className="feature-empty-state">
          <div className="feature-empty-icon" aria-hidden="true">
            ✉
          </div>
          <h2>Connect Gmail for a morning briefing</h2>
          <p>
            With your permission, this feature reads up to 30 recent inbox
            messages and sends only sender, subject, date and a short snippet to
            Gemini to create a summary. It cannot send, move, label or delete
            email.
          </p>
          <div className="provider-buttons">
            <button
              type="button"
              className="primary-action"
              onClick={() => {
                window.location.assign(
                  new URL("/api/email-summary/connect", window.location.origin)
                    .href,
                );
              }}
            >
              Connect Gmail read-only
            </button>
          </div>
        </div>
      ) : (
        <div className="feature-connected-state">
          <div className="feature-connected-card">
            <div className="connected-header">
              <div className="feature-empty-icon" aria-hidden="true">
                ✓
              </div>
              <div>
                <h2>Gmail connected</h2>
                <p>Your inbox is read only for this briefing.</p>
              </div>
            </div>
            <div className="status-row">
              <div>
                <span className="meta-label">Account</span>
                <strong>{status.emailAddress}</strong>
              </div>
              <div>
                <span className="meta-label">Schedule</span>
                <strong>{status.schedule}</strong>
              </div>
            </div>
            <div className="summary-panel">
              <div className="summary-header-row">
                <h3>Latest briefing</h3>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => void refresh()}
                  disabled={busy}
                >
                  {busy ? "Working…" : "Refresh now"}
                </button>
              </div>
              {summary ? (
                <>
                  <p className="summary-headline">{summary.headline}</p>
                  <p className="summary-generated-at">
                    Generated {new Date(summary.generatedAt).toLocaleString()}
                  </p>
                  <div className="summary-stats">
                    <span>{summary.totalEmails} emails</span>
                    <span>{summary.urgentCount} urgent</span>
                    <span>{summary.meetingCount} meetings</span>
                    <span>{summary.requestCount} requests</span>
                  </div>
                  <div className="summary-content-grid">
                    <div className="summary-section">
                      <h4>Action items</h4>
                      {summary.actionItems.length ? (
                        <ul>
                          {summary.actionItems.map((item, index) => (
                            <li key={`${index}-${item}`}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>None identified.</p>
                      )}
                    </div>
                    <div className="summary-section">
                      <h4>Priority notes</h4>
                      {summary.notes.length ? (
                        <ul>
                          {summary.notes.map((item, index) => (
                            <li key={`${index}-${item}`}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>None identified.</p>
                      )}
                    </div>
                  </div>
                  {summary.items.length > 0 && (
                    <div className="summary-items">
                      {summary.items.map((item, index) => (
                        <div
                          key={`${index}-${item.title}`}
                          className={`summary-item summary-item--${item.type}`}
                        >
                          <span className="summary-item-type">{item.type}</span>
                          <strong>{item.title}</strong>
                          <p>{item.detail}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="summary-placeholder">
                  No briefing yet. Refresh now or wait for the next morning run.
                </p>
              )}
            </div>
            <div className="action-row">
              <button
                type="button"
                className="ghost-action"
                onClick={() => void disconnect()}
                disabled={busy}
              >
                Disconnect Gmail and remove briefings
              </button>
            </div>
          </div>
        </div>
      )}
      <EmailDraftDemo />
      <div className="feature-meta">
        <div>
          <span className="meta-label">Status</span>
          <strong>
            {status?.connected ? "Gmail connected" : "Not connected"}
          </strong>
        </div>
        <div>
          <span className="meta-label">Delivery</span>
          <strong>On this page only</strong>
        </div>
        <div>
          <span className="meta-label">Access</span>
          <strong>Gmail read-only</strong>
        </div>
      </div>
    </section>
  );
}
