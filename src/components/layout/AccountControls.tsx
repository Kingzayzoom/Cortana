"use client";
import { useEffect, useState } from "react";
import { useLearning } from "@/lib/learning/provider";

/** Google's multi-colour "G". Required mark when offering Google sign-in. */
function GoogleMark() {
  return (
    <svg
      viewBox="0 0 48 48"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export function GoogleSignInButton({
  label = "Sign in with Google",
}: {
  label?: string;
}) {
  // A real document navigation to an API route that 302s to Google. next/link
  // would route this client-side and never reach the provider.
  return (
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a className="google-signin" href="/api/auth/google">
      <GoogleMark />
      <span>{label}</span>
    </a>
  );
}

const MESSAGES: Record<string, string> = {
  denied: "Sign-in was cancelled. You can keep exploring as a demo profile.",
  state: "That sign-in link expired or was already used. Please try again.",
  expired: "That sign-in attempt expired. Please try again.",
  provider: "Google could not be reached. Check your network, then try again.",
  config: "Google sign-in is not configured on this server.",
  server: "Sign-in could not be completed. Please try again.",
};

/**
 * Reads the one-shot result of a sign-in redirect, then strips it from the URL
 * so a refresh does not replay the notice. Reading `location` in an effect
 * avoids putting the whole page behind a Suspense boundary for useSearchParams.
 */
export function AuthNotice() {
  const { refresh } = useLearning();
  const [notice, setNotice] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const failure = params.get("auth_error"),
      success = params.get("signed_in");
    if (!failure && !success) return;
    setNotice(
      success
        ? {
            tone: "ok",
            text: "You're signed in. Your progress now follows your Google account.",
          }
        : { tone: "error", text: MESSAGES[failure!] ?? MESSAGES.server },
    );
    params.delete("auth_error");
    params.delete("signed_in");
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (query ? `?${query}` : ""),
    );
    if (success) void refresh();
  }, [refresh]);
  if (!notice) return null;
  return (
    <div
      className={`auth-notice ${notice.tone}`}
      role={notice.tone === "error" ? "alert" : "status"}
    >
      <span>{notice.text}</span>
      <button type="button" onClick={() => setNotice(null)}>
        Dismiss
      </button>
    </div>
  );
}

/** The topbar identity control: sign in, or show who is signed in. */
export function AccountBadge() {
  const { data } = useLearning();
  if (!data) return null;
  if (!data.account)
    return data.googleConfigured ? <GoogleSignInButton /> : null;
  const { name, email, picture } = data.account;
  const label = name || email || "Signed in";
  return (
    <span
      className="account-badge"
      title={email ? `Signed in as ${email}` : label}
    >
      {picture ? (
        // Google-hosted avatar; next/image would need a remotePatterns entry.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={picture}
          alt=""
          width={22}
          height={22}
          referrerPolicy="no-referrer"
        />
      ) : (
        <GoogleMark />
      )}
      <span>{label}</span>
    </span>
  );
}

export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="signout-button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch("/api/auth/signout", { method: "POST" });
          // A full document load, deliberately: it drops every in-memory trace
          // of the previous identity and bootstraps a fresh anonymous profile.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign("/");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
