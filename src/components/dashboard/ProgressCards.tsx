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
export function ProgressCards() {
  const { data } = useLearning();
  const attempts = data?.attempts || [],
    correct = attempts.filter((a) => a.correct).length;
  return (
    <div className="progress-grid">
      <section className="pulse-card panel">
        <div className="card-heading">
          <span className="icon-disc">
            <ChartNoAxesCombined size={22} />
          </span>
          <div>
            <h2>Your Learning Pulse</h2>
            <p>Your practice, taking shape.</p>
          </div>
          <Link
            href="/profile"
            className="subtle-icon-link"
            aria-label="View learning profile"
          >
            <ArrowUpRight size={19} />
          </Link>
        </div>
        <div className="pulse-row">
          <div>
            <span>Heart failure</span>
            <span>
              {attempts.length
                ? `${correct} of ${attempts.length} correct`
                : "Your first round awaits"}
            </span>
          </div>
          <div className="progress-track">
            <span
              style={{
                width: attempts.length
                  ? `${(correct / attempts.length) * 100}%`
                  : "0%",
              }}
            />
          </div>
        </div>
        <p className="small muted">
          {attempts.length
            ? "Actual practice results · saved for this demo profile"
            : "Complete a challenge to see your learning grow."}
        </p>
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
      </section>
      <section className="recent-card panel">
        <div className="card-heading">
          <span className="icon-disc">
            <Bookmark size={20} />
          </span>
          <div>
            <h2>{data?.review ? "Your next review" : "Recent Topics"}</h2>
            <p>
              {data?.review
                ? "A little reinforcement."
                : "Start with what matters."}
            </p>
          </div>
        </div>
        <Link href="/rounds" className="recent-topic">
          <span>
            <strong>Heart failure</strong>
            <small>
              {data?.review
                ? `Suggested ${data.review.date}`
                : "DAPA-HF · Ready to explore"}
            </small>
          </span>
          <ArrowRight size={19} />
        </Link>
      </section>
    </div>
  );
}
