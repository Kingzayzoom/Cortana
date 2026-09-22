"use client";
// Per-concept activity for a session (explored, practised, reinforced, review
// next) with the reasons behind each status, and the JSON export.
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Download, Activity } from "lucide-react";
import { useLearning } from "@/lib/learning/provider";
import { selectLearningSummary } from "@/lib/learning-signals/selectors";
import { conceptLabels } from "@/lib/learning-signals/types";
import { buildLearningSignalPayload } from "@/lib/impiricus/buildLearningSignalPayload";
import { selectNextRound } from "@/lib/adaptive-learning/selectNextRound";
export function LearningSignalSummary({
  expanded = false,
}: {
  expanded?: boolean;
}) {
  const { data } = useLearning();
  const [open, setOpen] = useState(expanded);
  const sessionId = data?.run?.id;
  if (!sessionId)
    return (
      <p className="signal-empty">
        Start a round to generate your first learning signal.
      </p>
    );
  const signals = data.learningSignals ?? [];
  const summary = selectLearningSummary(signals, sessionId);
  const payload = buildLearningSignalPayload(signals, sessionId);
  const next = selectNextRound(signals);
  const download = () => {
    if (!payload) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "samantha-learning-signal.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section className="learning-signal" aria-label="Learning signal">
      <div className="signal-heading">
        <Activity size={21} />
        <h3>Your learning signal</h3>
        <span className="signal-mode">
          {summary.mode === "voice"
            ? "Voice round"
            : summary.mode === "preview"
              ? "Text preview"
              : "Awaiting activity"}
        </span>
      </div>
      <p>A record of what you explored and practiced in this round.</p>
      <dl className="signal-metrics">
        <div>
          <dt>Concepts explored</dt>
          <dd>{summary.conceptsExplored.length}</dd>
        </div>
        <div>
          <dt>Practice</dt>
          <dd>
            {summary.correct}
            <span> / {summary.attempted} correct</span>
          </dd>
        </div>
        <div>
          <dt>Evidence follow-ups</dt>
          <dd>{summary.evidenceFollowUps}</dd>
        </div>
        <div>
          <dt>Elapsed round time</dt>
          <dd>
            {summary.durationSeconds === null
              ? "In progress"
              : summary.durationSeconds < 60
                ? `${summary.durationSeconds}s`
                : `${Math.floor(summary.durationSeconds / 60)}m ${summary.durationSeconds % 60}s`}
          </dd>
        </div>
      </dl>
      <button
        className="text-button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "Hide learning signal" : "View learning signal"}
        <ArrowUpRight size={16} />
      </button>
      {open && (
        <div className="signal-detail">
          <dl className="signal-description">
            <div>
              <dt>Concepts explored</dt>
              <dd>
                {summary.conceptsExplored
                  .map((id) => conceptLabels[id])
                  .join(" · ") || "No concept activity recorded yet"}
              </dd>
            </div>
            <div>
              <dt>Questions asked · {summary.questionsAsked}</dt>
              <dd>
                {Object.entries(summary.categories)
                  .map(
                    ([category, count]) =>
                      `${category.replaceAll("_", " ")} (${count})`,
                  )
                  .join(" · ") || "No questions recorded"}
              </dd>
            </div>
            <div>
              <dt>Evidence opened</dt>
              <dd>
                {summary.evidenceViewed.join(" · ") || "No source opened"}
              </dd>
            </div>
            <div>
              <dt>Reinforced through practice</dt>
              <dd>
                {summary.reinforced
                  .map((id) => conceptLabels[id])
                  .join(" · ") ||
                  "None recorded. Reinforcement requires a previous miss followed by a correct response."}
              </dd>
            </div>
            <div>
              <dt>Consider revisiting</dt>
              <dd>
                {summary.reviewNext
                  .map((concept) => conceptLabels[concept.id])
                  .join(" · ") ||
                  "No reinforcement topics suggested by the current rules."}
              </dd>
            </div>
          </dl>
          {next && (
            <div className="signal-next">
              <strong>Next supported round · Heart failure</strong>
              <p>{next.reason}</p>
              <Link href="/rounds" className="text-button">
                See your next round <ArrowUpRight size={15} />
              </Link>
            </div>
          )}
          <p className="small muted">
            Elapsed time includes pauses and time away. These are observable
            learning activities, not a measure of clinical ability.
          </p>
          <details className="payload-details">
            <summary>Developer payload · proposed integration</summary>
            <p>
              Structured metadata only. Exported locally; nothing is sent to
              Impiricus.
            </p>
            <button
              className="text-button"
              onClick={download}
              disabled={!payload}
            >
              <Download size={16} />
              Export learning signal JSON
            </button>
            <pre>
              {payload
                ? JSON.stringify(payload, null, 2)
                : "Begin a round to generate a payload."}
            </pre>
          </details>
        </div>
      )}
    </section>
  );
}
