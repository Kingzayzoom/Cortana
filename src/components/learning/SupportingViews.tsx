"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Clock3,
  HeartPulse,
  Search,
  CheckCircle2,
  Layers,
  Bookmark,
  ChartNoAxesCombined,
} from "lucide-react";
import { useLearning } from "@/lib/learning/provider";
import { useVoice } from "@/lib/voice/provider";
import { round, sources } from "@/lib/content/round";
import { Button } from "@/components/ui/button";
import { selectNextRound } from "@/lib/adaptive-learning/selectNextRound";
import { LearningSignalSummary } from "./LearningSignalSummary";
export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-heading">
      <p>{eyebrow}</p>
      <h1>{title}</h1>
      <span>{description}</span>
    </div>
  );
}
export function RoundsView() {
  const { data } = useLearning(),
    voice = useVoice(),
    router = useRouter();
  const completed = data?.completions.length;
  const open = async () => {
    if (voice.connection !== "connected" && !voice.preview)
      await voice.startPreview();
    router.push("/");
  };
  return (
    <>
      <PageHeading
        eyebrow="My Rounds"
        title="A little learning, on repeat."
        description="Your available rounds and the conversations you’ve completed."
      />
      <div className="rounds-section-title">
        <h2>
          {completed
            ? "Completed & ready to revisit"
            : "Ready for your first round"}
        </h2>
        <span className="tag">1 ROUND</span>
      </div>
      <article className="available-round panel">
        <div className="round-art">
          <HeartPulse size={58} strokeWidth={1} />
          <span>01</span>
        </div>
        <div className="available-round-content">
          <div className="round-meta">
            <span>Cardiology</span>
            <span>
              <Clock3 size={14} />2 min
            </span>
            {completed ? (
              <span className="success-text">
                <CheckCircle2 size={14} />
                Completed
              </span>
            ) : null}
          </div>
          <h2>{round.title}</h2>
          <p>{round.description}</p>
          <p className="small muted">
            {selectNextRound(data?.learningSignals ?? [])?.reason}
          </p>
          <div className="round-meta">
            <span>2 sources</span>
            <span>1 synthetic case</span>
            <span>Version {round.version}</span>
          </div>
          <Button
            onClick={() => {
              void open();
            }}
            disabled={voice.working}
          >
            {completed ? "Review this round" : "Open round"}
            <ArrowRight size={16} />
          </Button>
        </div>
      </article>
      {data?.review && (
        <div className="review-note">
          <Bookmark size={21} />
          <div>
            <h3>Next review · {data.review.date}</h3>
            <p>{data.review.reason}</p>
          </div>
        </div>
      )}
      <div className="empty-history">
        <Layers size={24} />
        <h3>
          {completed
            ? "You’re building a learning habit."
            : "Your history starts here."}
        </h3>
        <p>
          {completed
            ? "Completed rounds stay here so you can revisit the evidence."
            : "Complete your first round and it will be saved here. No sample history, just your practice."}
        </p>
      </div>
    </>
  );
}
export function EvidenceView() {
  const [search, setSearch] = useState("");
  const { openEvidence } = useLearning();
  const filtered = sources.filter((source) =>
    `${source.title} ${source.publisher} ${source.summary}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="Evidence Library"
        title="Go straight to the source."
        description="A small, curated evidence set. Every citation has somewhere real to take you."
      />
      <div className="library-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Search evidence"
            placeholder="Search sources, studies, or topics"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <span className="small muted">{filtered.length} sources</span>
      </div>
      <div className="source-list">
        {filtered.map((source) => (
          <button
            className="source-row"
            key={source.id}
            onClick={() => openEvidence(source.id)}
          >
            <span className="source-document">
              <BookOpen size={25} strokeWidth={1.5} />
            </span>
            <span>
              <span className="source-row-meta">
                {source.publisher} <span>·</span> {source.date}
              </span>
              <strong>{source.title}</strong>
              <small>
                {source.id === "dapa-hf"
                  ? "Randomized trial · Heart failure"
                  : "Exploratory analysis · Diabetes subgroups"}
              </small>
            </span>
            <ArrowUpRight size={21} />
          </button>
        ))}
        {!filtered.length && (
          <div className="empty-history">
            <Search size={25} />
            <h3>No sources match “{search}”.</h3>
            <p>Try “heart failure”, “diabetes”, or “DAPA”.</p>
            <button className="text-button" onClick={() => setSearch("")}>
              Clear search
            </button>
          </div>
        )}
      </div>
      <p className="library-note">
        These two publications describe the same trial. The subgroup analysis is
        not independent replication.
      </p>
    </>
  );
}
export function ProfileView() {
  const { data } = useLearning();
  const correct = data?.attempts.filter((a) => a.correct).length || 0,
    attempts = data?.attempts.length || 0;
  return (
    <>
      <PageHeading
        eyebrow="Learning Profile"
        title="Your practice. Your pace."
        description="A clear view of what you’ve practiced, and where to return next."
      />
      <div className="profile-summary panel">
        <div className="profile-person">
          <span className="avatar large">
            {(data?.preferences.name || "DP")
              .replace(/^Dr\.?\s*/i, "")
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <div>
            <h2>{data?.preferences.name || "Dr. Patel"}</h2>
            <p>
              Cardiology <span>·</span> Demo profile
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/settings">Edit profile</Link>
          </Button>
        </div>
        <dl className="profile-numbers">
          <div>
            <dt>Rounds completed</dt>
            <dd>{data?.completions.length || 0}</dd>
          </div>
          <div>
            <dt>Practice attempts</dt>
            <dd>{attempts}</dd>
          </div>
          <div>
            <dt>Current streak</dt>
            <dd>
              {data?.streak || 0}
              <span> days</span>
            </dd>
          </div>
          <div>
            <dt>Total earned</dt>
            <dd>
              {data?.xp || 0}
              <span> XP</span>
            </dd>
          </div>
        </dl>
      </div>
      <section className="topic-results">
        <LearningSignalSummary />
        <h2>Your Learning Pulse</h2>
        <div className="topic-result-row">
          <HeartPulse size={25} />
          <div>
            <h3>Heart failure</h3>
            <p>
              {attempts
                ? `${correct} of ${attempts} practice questions correct`
                : "Not practiced yet"}
            </p>
          </div>
          <div className="progress-track">
            <span
              style={{
                width: attempts ? `${(correct / attempts) * 100}%` : "0%",
              }}
            />
          </div>
          <Link href="/rounds" className="text-button">
            {attempts ? "Review" : "Explore"}
            <ArrowRight size={15} />
          </Link>
        </div>
        <p className="small muted">
          Practice results describe your answers in this prototype. They are not
          a measure of clinical competence.
        </p>
      </section>
      <div className="review-note">
        <ChartNoAxesCombined size={23} />
        <div>
          <h3>
            {data?.review
              ? `Suggested review · ${data.review.date}`
              : "Your next step"}
          </h3>
          <p>
            {data?.review?.reason ||
              "Try the DAPA-HF round. After your first answer, we’ll suggest a review using a simple, transparent rule."}
          </p>
        </div>
      </div>
      <p className="small muted storage-note">
        {data?.storage}. No cloud synchronization or sample history.
      </p>
    </>
  );
}
export function TopicsView() {
  return (
    <>
      <PageHeading
        eyebrow="Topics"
        title="Start with the heart."
        description="Focused cardiology learning, one conversation at a time."
      />
      <section className="topic-feature panel">
        <span className="topic-large-icon">
          <HeartPulse size={50} strokeWidth={1.1} />
        </span>
        <div>
          <span className="tag">AVAILABLE NOW</span>
          <h2>Heart failure</h2>
          <p>
            Study populations, composite outcomes, and the limits of the DAPA-HF
            evidence.
          </p>
          <div className="round-meta">
            <span>1 round</span>
            <span>2 sources</span>
            <span>1 practice question</span>
          </div>
          <Button asChild>
            <Link href="/rounds">
              Explore heart failure
              <ArrowRight size={17} />
            </Link>
          </Button>
        </div>
      </section>
      <section className="future-topics">
        <h2>Room to grow.</h2>
        <p>These topics don’t have learning content yet.</p>
        {["Hypertension", "Anticoagulation", "Preventive cardiology"].map(
          (topic) => (
            <div className="future-topic" key={topic}>
              <span>{topic}</span>
              <span className="small muted">Not yet available</span>
            </div>
          ),
        )}
      </section>
    </>
  );
}
