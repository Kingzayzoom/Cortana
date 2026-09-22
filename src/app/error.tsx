"use client";
// Route error boundary: a calm retry instead of a broken page. Progress is
// saved server-side, so nothing is lost by retrying.
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="not-found">
      <h1>Your workspace needs a moment.</h1>
      <p>
        Something didn’t load correctly. Your saved progress is still on the
        demo server.
      </p>
      <button onClick={reset} className="button button-primary">
        Try again
      </button>
    </main>
  );
}
