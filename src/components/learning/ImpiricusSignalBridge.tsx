"use client";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useLearning } from "@/lib/learning/provider";
import { selectLearningSummary } from "@/lib/learning-signals/selectors";
import { LearningSignalSummary } from "./LearningSignalSummary";
const eventLabels = {
  prime_started: "Prime started",
  prime_question_attempted: "Prime question practiced",
  prime_question_correct: "Prime correct response",
  prime_question_missed: "Prime reinforcement requested",
  prime_evidence_viewed: "Prime evidence opened",
  prime_completed: "Prime completed",
  round_started: "Round started",
  briefing_section_viewed: "Briefing section explored",
  briefing_completed: "Briefing completed",
  briefing_interrupted: "Briefing interrupted",
  question_asked: "Question asked",
  evidence_viewed: "Evidence opened",
  challenge_attempted: "Challenge attempted",
  challenge_resolved: "Practice response resolved",
  concept_reinforced: "Concept reinforced",
  round_completed: "Round completed",
};
export function ImpiricusSignalBridge({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { data } = useLearning();
  const summary = selectLearningSummary(
    data?.learningSignals ?? [],
    data?.run?.id ?? "none",
  );
  if (compact)
    return (
      <Link href="/impiricus" className="bridge-link">
        <span>
          <strong>From this round to the next interaction</strong>
          <small>Explore the proposed Impiricus signal bridge</small>
        </span>
        <ArrowUpRight size={20} />
      </Link>
    );
  return (
    <div
      className="integration-view"
      data-reduced-motion={data?.preferences.reducedMotion ? "true" : "false"}
    >
      <header className="integration-intro">
        <span className="tag">PROPOSED INTEGRATION</span>
        <h1>Go beyond engagement.</h1>
        <p>
          Cortana turns educational interactions into structured learning
          signals.
        </p>
        <div className="integration-disclosure">
          Working Cortana activity. Conceptual Impiricus connection. No
          production integration, private Impiricus data, or endorsement.
        </div>
      </header>
      <section className="platform-context">
        <h2>Impiricus today</h2>
        <p>
          An established platform for physician engagement and coordinated
          resources.
        </p>
        <dl className="platform-roles">
          <div>
            <dt>ION</dt>
            <dd>
              Intelligence that informs the next action across commercial
              functions.
            </dd>
          </div>
          <div>
            <dt>Pulse</dt>
            <dd>
              Personalized resources and on-demand access through an opted-in
              HCP SMS network.
            </dd>
          </div>
          <div>
            <dt>Spark</dt>
            <dd>
              Engagement journeys triggered by physician signals and real-world
              events.
            </dd>
          </div>
          <div>
            <dt>Ascend</dt>
            <dd>
              Always-on connections to field representatives and resources.
            </dd>
          </div>
        </dl>
        <a
          className="text-button"
          href="https://impiricus.com/our-products"
          target="_blank"
          rel="noreferrer"
        >
          Source: Impiricus product descriptions <ArrowUpRight size={14} />
        </a>
      </section>
      <section className="signal-comparison">
        <div>
          <span className="comparison-label">Engagement</span>
          <h2>What was opened.</h2>
          <p>A resource delivered. A link clicked. An interaction started.</p>
          <small>
            Illustrative engagement signals; no Impiricus data is connected.
          </small>
        </div>
        <div>
          <span className="comparison-label">Learning interactions</span>
          <h2>What was explored.</h2>
          <p>
            Questions asked. Evidence revisited. Practice responses. Concepts to
            reinforce.
          </p>
          <small>
            Derived from this browser profile’s actual Cortana activity.
          </small>
        </div>
      </section>
      <section className="bridge-section">
        <div className="bridge-title">
          <h2>A learning layer after engagement</h2>
          <span className="tag">CONCEPTUAL FEEDBACK LOOP</span>
        </div>
        <ol className="signal-bridge">
          <li>
            <span className="bridge-dot" />
            <strong>Impiricus</strong>
            <p>Engagement signal</p>
            <small>Proposed input</small>
          </li>
          <li>
            <span className="bridge-dot" />
            <strong>Cortana</strong>
            <p>Listen · ask · practice</p>
            <small>Working experience</small>
          </li>
          <li>
            <span className="bridge-dot" />
            <strong>Learning signal</strong>
            <p>{summary.signals.length} recorded events</p>
            <small>Structured metadata</small>
          </li>
          <li>
            <span className="bridge-dot" />
            <strong>ION concept</strong>
            <p>Educational intent</p>
            <small>Export adapter only</small>
          </li>
          <li>
            <span className="bridge-dot" />
            <strong>Next interaction</strong>
            <p>Supported reinforcement</p>
            <small>Local recommendation</small>
          </li>
        </ol>
        <p className="bridge-caption">
          Cortana adds educational context to a potential future feedback loop.
          The current app recommends only its supported DAPA-HF round.
        </p>
      </section>
      <section className="integration-activity">
        <div>
          <h2>This session, observed</h2>
          <p>
            {summary.mode === "preview"
              ? "Text-preview activity"
              : summary.mode === "voice"
                ? "Voice-round activity"
                : "No round activity yet"}{" "}
            · timestamps saved by this demo server.
          </p>
          {summary.signals.length ? (
            <ol className="event-timeline">
              {summary.signals.slice(-12).map((event) => (
                <li key={event.id}>
                  <span>
                    <strong>{eventLabels[event.type]}</strong>
                    <small>
                      {event.type === "question_asked"
                        ? event.category.replaceAll("_", " ")
                        : event.type === "evidence_viewed"
                          ? event.sourceId
                          : event.type === "challenge_resolved"
                            ? event.correct
                              ? "Correct practice response"
                              : "Incorrect practice response"
                            : event.conceptIds
                                .map((id) => id.replaceAll("-", " "))
                                .join(" · ")}
                    </small>
                  </span>
                  <time dateTime={event.timestamp}>
                    {new Date(event.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <div className="signal-empty">
              <p>
                Start a round to see real activity here. No sample events are
                inserted.
              </p>
              <Link href="/" className="text-button">
                Open today’s round <ArrowRight size={16} />
              </Link>
            </div>
          )}
          {summary.signals.length > 12 && (
            <p className="small muted">
              Showing the latest 12 of {summary.signals.length} session events.
            </p>
          )}
        </div>
        <LearningSignalSummary expanded />
      </section>
      <section className="integration-value">
        <h2>Educational context for the next interaction.</h2>
        <dl>
          <div>
            <dt>Medical Affairs</dt>
            <dd>Visibility into educational topics that generate questions.</dd>
          </div>
          <div>
            <dt>Brand teams</dt>
            <dd>
              Context about approved concepts that may benefit from
              reinforcement.
            </dd>
          </div>
          <div>
            <dt>Healthcare professionals</dt>
            <dd>
              Short, interactive learning with a transparent reason for the next
              round.
            </dd>
          </div>
        </dl>
        <p>
          These are proposed uses, not measured commercial outcomes. Cortana
          supports learning activity; it does not assess competency or recommend
          care for a patient.
        </p>
      </section>
    </div>
  );
}
