"use client";
import { useEffect, useState } from "react";
import { Check, RotateCcw, Volume2 } from "lucide-react";
import { useLearning } from "@/lib/learning/provider";
import {
  GoogleSignInButton,
  SignOutButton,
} from "@/components/layout/AccountControls";
import { useVoice } from "@/lib/voice/provider";
import { PageHeading } from "./SupportingViews";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { Preferences } from "@/lib/learning/types";
function AccountSection() {
  const { data } = useLearning();
  const account = data?.account;
  return (
    <section className="settings-section">
      <div>
        <h2>Your account</h2>
        <p>
          {account
            ? "Your practice history is linked to this Google account."
            : "Sign in to keep your progress when you change browser or device."}
        </p>
      </div>
      <div className="settings-fields">
        {account ? (
          <div className="account-row">
            <div>
              <p className="account-name">{account.name || "Signed in with Google"}</p>
              {account.email && <p className="account-email">{account.email}</p>}
            </div>
            <SignOutButton />
          </div>
        ) : data?.googleConfigured ? (
          <div className="account-row">
            <p className="account-email">
              Right now this profile lives only in this browser. Clearing cookies loses it.
            </p>
            <GoogleSignInButton />
          </div>
        ) : (
          <p className="account-email">
            Google sign-in is not configured on this server. This profile stays in
            this browser.
          </p>
        )}
      </div>
    </section>
  );
}

function SettingsForm({ preferences }: { preferences: Preferences }) {
  const { act, busy, clearMessages } = useLearning(),
    voice = useVoice();
  const [draft, setDraft] = useState(preferences),
    [saved, setSaved] = useState(false),
    [reset, setReset] = useState(false),
    [volume, setVolume] = useState(100);
  useEffect(() => {
    setDraft(preferences);
  }, [preferences]);
  const update = (value: Partial<Preferences>) => {
    setDraft((d) => ({ ...d, ...value }));
    setSaved(false);
  };
  return (
    <>
      <form
        className="settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          void act({ action: "preferences", preferences: draft })
            .then(() => setSaved(true))
            .catch(() => {});
        }}
      >
        <AccountSection />
        <section className="settings-section">
          <div>
            <h2>Your demo profile</h2>
            <p>Personalize this workspace.</p>
          </div>
          <div className="settings-fields">
            <label className="field-label">
              Display name
              <input
                className="input"
                value={draft.name}
                onChange={(event) => update({ name: event.target.value })}
                minLength={1}
                maxLength={40}
                required
              />
            </label>
            <label className="field-label">
              Specialty
              <select className="input">
                <option>Cardiology</option>
              </select>
            </label>
            <label className="field-label">
              Timezone
              <select
                className="input"
                value={draft.timezone}
                onChange={(event) => update({ timezone: event.target.value })}
              >
                {Array.from(
                  new Set([
                    draft.timezone,
                    "America/New_York",
                    "America/Chicago",
                    "America/Denver",
                    "America/Los_Angeles",
                    "Europe/London",
                    "Europe/Paris",
                    "Asia/Kolkata",
                    "Asia/Tokyo",
                    "Australia/Sydney",
                    "UTC",
                    ...Intl.supportedValuesOf("timeZone"),
                  ]),
                ).map((zone) => (
                  <option key={zone}>{zone}</option>
                ))}
              </select>
              <small>
                Used for greetings, daily streaks, and review dates.
              </small>
            </label>
          </div>
        </section>
        <section className="settings-section">
          <div>
            <h2>Make yourself comfortable</h2>
            <p>Choose how you learn.</p>
          </div>
          <div className="settings-fields">
            <label className="toggle-row">
              <span>
                <strong>Reduce motion</strong>
                <small>
                  Keep the orb still. Your system preference is also respected.
                </small>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={draft.reducedMotion}
                onChange={(event) =>
                  update({ reducedMotion: event.target.checked })
                }
              />
            </label>
            <label className="toggle-row">
              <span>
                <strong>Show transcripts by default</strong>
                <small>Follow the conversation in text as you listen.</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={draft.transcript}
                onChange={(event) =>
                  update({ transcript: event.target.checked })
                }
              />
            </label>
            <label className="volume-setting">
              <span>
                <Volume2 size={17} />
                Voice output{" "}
                <small>
                  {voice.connection === "connected"
                    ? `${volume}%`
                    : "Available during a live session"}
                </small>
              </span>
              <input
                aria-label="Voice output volume"
                type="range"
                min="0"
                max="100"
                value={volume}
                disabled={voice.connection !== "connected"}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setVolume(value);
                  voice.setOutputVolume(value / 100);
                }}
              />
            </label>
          </div>
        </section>
        <div className="settings-save">
          <Button type="submit" disabled={busy || !draft.name.trim()}>
            Save preferences
            <Check size={16} />
          </Button>
          {saved && (
            <span className="success-text" role="status">
              Preferences saved
            </span>
          )}
        </div>
      </form>
      <section className="settings-section reset-section">
        <div>
          <h2>A fresh start</h2>
          <p>
            Progress is saved on this demo server and linked to your browser
            cookie. It is not cloud synchronization.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setReset(true)}>
          <RotateCcw size={16} />
          Reset demo data
        </Button>
      </section>
      <Dialog
        open={reset}
        onOpenChange={setReset}
        title="Start fresh?"
        description="This removes this demo profile’s answers, completed rounds, review schedule, and preferences. Other demo profiles are unaffected."
      >
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setReset(false)}>
            Keep my progress
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => {
              voice.end();
              void act({ action: "reset", confirmation: "RESET" })
                .then(() => {
                  clearMessages();
                  setReset(false);
                })
                .catch(() => {});
            }}
          >
            Reset this profile
          </Button>
        </div>
      </Dialog>
    </>
  );
}
export function SettingsView() {
  const { data } = useLearning();
  return (
    <>
      <PageHeading
        eyebrow="Settings"
        title="A workspace that fits you."
        description="A few thoughtful preferences for your daily conversation."
      />
      {data ? (
        <SettingsForm preferences={data.preferences} />
      ) : (
        <p>Loading your preferences…</p>
      )}
    </>
  );
}
