"use client";
import { useEffect, useRef, useState } from "react";
import { Phone, PhoneCall, ShieldCheck, Check } from "lucide-react";
import { useLearning } from "@/lib/learning/provider";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/learning/SupportingViews";

type CallState =
  | { step: "form" }
  | { step: "calling"; to: string; conversationId: string | null }
  | { step: "ended"; to: string };

export function PhoneRoundView() {
  const { data, refresh } = useLearning();
  const [number, setNumber] = useState(""),
    [code, setCode] = useState("");
  const [consent, setConsent] = useState(false),
    [permission, setPermission] = useState(false);
  const [call, setCall] = useState<CallState>({ step: "form" });
  const [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  // Follow the call so the page can show progress the moment it ends.
  useEffect(() => {
    if (call.step !== "calling" || !call.conversationId) return;
    const conversationId = call.conversationId,
      to = call.to;
    timer.current = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/phone/status?conversationId=${encodeURIComponent(conversationId)}`,
          { cache: "no-store" },
        );
        const body = await response.json();
        if (["done", "failed", "processing"].includes(body.status)) {
          clearInterval(timer.current);
          setCall({ step: "ended", to });
          await refresh();
        }
      } catch {
        // A status hiccup shouldn't interrupt a call that is going fine.
      }
    }, 5000);
    return () => clearInterval(timer.current);
  }, [call, refresh]);

  const place = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/phone/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessCode: code,
          phoneNumber: number.trim(),
          consent: true,
          permission: true,
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "The call could not be placed.");
      setCall({
        step: "calling",
        to: body.calling,
        conversationId: body.conversationId,
      });
      await refresh();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeading
        eyebrow="Phone round"
        title="Cortana can call you."
        description="Two minutes of evidence, on any phone. The same round, the same grading, no screen needed."
      />
      {call.step === "form" ? (
        <form className="settings-section" onSubmit={place}>
          <label className="field-label" htmlFor="phone-number">
            Phone number, with country code
          </label>
          <input
            id="phone-number"
            className="input"
            type="tel"
            autoComplete="tel"
            placeholder="+15715550123"
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            required
          />
          <label className="field-label" htmlFor="phone-code">
            Demo access code
          </label>
          <input
            id="phone-code"
            className="input"
            type="password"
            autoComplete="off"
            placeholder="Enter your private demo code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
          />
          <label className="toggle-row">
            <span>
              <strong>This is an AI voice call</strong>
              <small>
                Speech is processed by ElevenLabs to make the conversation
                possible. Use synthetic examples and keep real patient
                information out of it.
              </small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
          </label>
          <label className="toggle-row">
            <span>
              <strong>The person answering agreed to this call</strong>
              <small>
                Only call your own phone, or someone who asked for the demo.
                Normal call charges may apply to them.
              </small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={permission}
              onChange={(event) => setPermission(event.target.checked)}
            />
          </label>
          <div className="settings-save">
            <Button
              type="submit"
              disabled={
                busy ||
                !consent ||
                !permission ||
                !number.trim() ||
                !code ||
                !data
              }
            >
              {busy ? "Calling…" : "Call me now"}
              <Phone size={16} />
            </Button>
          </div>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
        </form>
      ) : (
        <div className="settings-section">
          <h2>
            {call.step === "calling" ? (
              <>
                <PhoneCall size={18} className="inline-icon" /> Calling{" "}
                {call.to}
              </>
            ) : (
              <>
                <Check size={18} className="inline-icon" /> Call ended
              </>
            )}
          </h2>
          <p>
            {call.step === "calling"
              ? "Answer the phone and say hello. Cortana runs the same round you would get here, and your answer is graded by this server."
              : "Your progress from the call is saved below and on Today."}
          </p>
          <p className="small muted">
            XP {data?.xp ?? 0} · Streak {data?.streak ?? 0} day
            {data?.streak === 1 ? "" : "s"}
            {data?.review ? ` · Next review ${data.review.date}` : ""}
          </p>
          <div className="settings-save">
            <Button
              variant="secondary"
              onClick={() => {
                clearInterval(timer.current);
                setCall({ step: "form" });
              }}
            >
              Call again
            </Button>
          </div>
        </div>
      )}
      <p className="small muted">
        <ShieldCheck size={16} className="inline-icon" />
        Cortana does not store the phone number or the call audio. Provider
        retention follows your ElevenLabs and Twilio account settings. Synthetic
        cases only; this is not medical advice.
      </p>
    </>
  );
}
