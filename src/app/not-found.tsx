import Link from "next/link";
export default function NotFound() {
  return (
    <main className="not-found">
      <p>SAMANTHA</p>
      <h1>Let’s find your way back.</h1>
      <p>This page isn’t in your workspace.</p>
      <Link href="/" className="button button-primary">
        Return to today’s round
      </Link>
    </main>
  );
}
