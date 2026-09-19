"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  Flame,
  Bookmark,
  ArrowRight,
} from "lucide-react";
import { useLearning } from "@/lib/learning/provider";
import { selectLearningSummary } from "@/lib/learning-signals/selectors";
import { conceptLabels } from "@/lib/learning-signals/types";
import { selectNextRound } from "@/lib/adaptive-learning/selectNextRound";
export function ProgressCards() {
  const { data } = useLearning();
  const summary = selectLearningSummary(data?.learningSignals ?? []);
  const next = selectNextRound(data?.learningSignals ?? []);
  return (
    <div className="progress-grid">
      <section className="pulse-card panel">
        <div className="card-heading">
          <span className="icon-disc">
            <ChartNoAxesCombined size={22} />
          </span>
          <div>
            <h2>Your Learning Pulse</h2>
            <p>Observable practice, over time.</p>
          </div>
          <Link
            href="/profile"
            className="subtle-icon-link"
            aria-label="View learning profile"
          >
            <ArrowUpRight size={19} />
          </Link>
        </div>
        {!data ? (
          <p role="status" className="muted">
            Loading your learning activity…
          </p>
        ) : (
          <>
            <dl className="pulse-facts">
              <div>
                <dt>Concepts explored</dt>
                <dd>{summary.conceptsExplored.length}</dd>
              </div>
              <div>
                <dt>Practice</dt>
                <dd>
                  {summary.correct}/{summary.attempted}
                  <small> correct</small>
                </dd>
              </div>
              <div>
                <dt>Evidence follow-ups</dt>
                <dd>{summary.evidenceFollowUps}</dd>
              </div>
            </dl>
            <ul className="concept-list">
              {summary.concepts.map((concept) => (
                <li key={concept.id}>
                  <span>{conceptLabels[concept.id]}</span>
                  <span
                    className={`concept-status ${concept.status.toLowerCase().replaceAll(" ", "-")}`}
                  >
                    {concept.status}
                  </span>
                </li>
              ))}
            </ul>
            <p className="small muted">
              Last practiced:{" "}
              {summary.lastPracticed
                ? new Date(summary.lastPracticed).toLocaleDateString()
                : "Not yet"}
            </p>
            {summary.reviewNext.length > 0 && (
              <details className="reinforcement-reasons">
                <summary>Why revisit these concepts?</summary>
                {summary.reviewNext.map((concept) => (
                  <p key={concept.id}>
                    <strong>
                      {conceptLabels[concept.id]} ·{" "}
                      {concept.priority >= 5
                        ? "Review next"
                        : "Consider reviewing"}
                    </strong>
                    <br />
                    {concept.reasons.join(". ")}.
                  </p>
                ))}
                <p>
                  Transparent rules: incorrect response +3; explicit
                  clarification +2; evidence after a miss +1; multiple questions
                  about a concept +1. Priority 0–2: no suggestion, 3–4: consider
                  reviewing, 5+: review next. A correct response after a miss
                  clears those earlier signals. These priorities are not ability
                  scores.
                </p>
              </details>
            )}
          </>
        )}
      </section>
      <section className="streak-card panel">
        <div className="card-heading">
          <span className="icon-disc lavender">
            <Flame size={21} />
          </span>
          <div>
            <h2>Streak & Progress</h2>
            <p>Small steps add up.</p>
          </div>
        </div>
        <div className="streak-stats">
          <div>
            <strong>
              {data?.streak || 0}
              <span> days</span>
            </strong>
            <p>Current streak</p>
          </div>
          <div>
            <strong>
              {data?.xp || 0}
              <span> XP</span>
            </strong>
            <p>Earned through practice</p>
          </div>
        </div>
        <p className="small muted">
          Practice history, not a measure of clinical ability.
        </p>
      </section>
      <section className="recent-card panel">
        <div className="card-heading">
          <span className="icon-disc">
            <Bookmark size={20} />
          </span>
          <div>
            <h2>Your next round</h2>
            <p>
              {next?.kind === "new"
                ? "A supported starting point."
                : "Guided by your activity."}
            </p>
          </div>
        </div>
        <Link href="/rounds" className="recent-topic">
          <span>
            <strong>Heart failure</strong>
            <small>DAPA-HF · Cardiology</small>
          </span>
          <ArrowRight size={19} />
        </Link>
        <p className="small muted">{next?.reason}</p>
      </section>
    </div>
  );
}
