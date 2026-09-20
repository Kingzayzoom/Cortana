"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, BookOpen, Clock3, X } from "lucide-react";
import { usePrime } from "@/lib/prime/provider";
import { useLearning } from "@/lib/learning/provider";
import { useVoice } from "@/lib/voice/provider";
import { conceptLabels } from "@/lib/learning-signals/types";
import { Button } from "@/components/ui/button";
import { LanguagePicker } from "@/components/voice/VoiceControls";
const reasons = {
  reinforcement: "Recommended for reinforcement",
  review: "Due for spaced review",
  new: "New concept",
  practice: "Continued practice",
};
export function PrimeStats() {
  const { data } = usePrime();
  if (!data) return null;
  return (
    <section className="panel prime-stats-panel">
      <p className="eyebrow">PRIME PRACTICE</p>
      <div className="prime-stats">
        {[
          [data.stats.questions, "Questions practiced"],
          [data.stats.correct, "Correct first attempt"],
          [data.stats.reinforced, "Concept reinforcements"],
          [data.stats.due, "Concepts due for review"],
        ].map(([value, label]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <p className="small muted">
        Practice history, not a measure of clinical competence.
      </p>
    </section>
  );
}
export function DailyPrimeCard() {
  const { data } = usePrime(),
    done = Boolean(data?.session?.completedAt);
  return (
    <section className="panel prime-daily-card">
      <div>
        <p className="eyebrow">DAILY PRIME</p>
        <h2>{done ? "Prime complete" : "2 minutes to stay sharp."}</h2>
        <p>
          {done
            ? "Your practice is saved. Come back tomorrow."
            : "3 questions · Evidence, feedback, and a reason to revisit."}
        </p>
        {!done && data && (
          <p className="small muted">
            {Object.entries(reasons)
              .map(([key, label]) => {
                const n =
                  data.session?.selection.filter((s) => s.reason === key)
                    .length ?? 0;
                return n ? n + " " + label.toLowerCase() : null;
              })
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>
      <Button asChild variant="secondary">
        <Link href="/prime">
          {done ? "View Prime" : "Start Prime"}
          <ArrowRight size={16} />
        </Link>
      </Button>
    </section>
  );
}
export function PrimeHome() {
  const prime = usePrime(),
    router = useRouter(),
    voice = useVoice();
  const s = prime.data?.session;
  const start = async (withVoice = false) => {
    try {
      await prime.act({ action: "start" });
      if (withVoice) voice.requestStart("prime");
      router.push("/prime/session");
    } catch {}
  };
  return (
    <div className="prime-home">
      <header className="prime-hero">
        <p className="eyebrow">CORTANA PRIME</p>
        <h1>
          2 minutes
          <br />
          <span>to stay sharp.</span>
        </h1>
        <p>
          A small daily practice.
          <br />A more considered return to the evidence.
        </p>
      </header>
      <section className="panel prime-today">
        <div className="prime-today-title">
          <h2>
            {s?.completedAt ? "Today's Prime is complete." : "Today's Prime"}
          </h2>
          <span>
            <Clock3 size={15} /> 3 questions · about 2 minutes
          </span>
        </div>
        {!prime.data && !prime.error && (
          <p role="status">Preparing your daily set…</p>
        )}
        <ol className="prime-composition">
          {s?.selection.map((item, i) => {
            const q = prime.data!.questions[i];
            return (
              <li key={item.questionId}>
                <span className="prime-index">0{i + 1}</span>
                <div>
                  <strong>{conceptLabels[q.conceptIds[0]]}</strong>
                  <p>{reasons[item.reason]}</p>
                  {item.contextRelevant && (
                    <small>
                      Relevant educational topic from today&apos;s synthetic
                      context.
                    </small>
                  )}
                </div>
                {s.answers[item.questionId] && <Check size={18} />}
              </li>
            );
          })}
        </ol>
        {prime.error && (
          <p role="alert" className="inline-error">
            {prime.error}
            <button
              className="text-button"
              onClick={() => void prime.refresh()}
            >
              Retry
            </button>
          </p>
        )}
        <div className="prime-start-actions">
          <Button
            disabled={!s || prime.busy || voice.connection === "connected"}
            onClick={() => void start()}
          >
            {s?.completedAt
              ? "View completion"
              : s?.startedAt
                ? "Resume Prime"
                : "Start Prime"}
            <ArrowRight size={17} />
          </Button>
          {!s?.completedAt && (
            <Button
              variant="secondary"
              disabled={
                !s ||
                prime.busy ||
                voice.working ||
                voice.connection === "connected"
              }
              onClick={() => void start(true)}
            >
              Start with Cortana
            </Button>
          )}
        </div>
        {!s?.completedAt && <LanguagePicker />}
        <p className="small muted">
          Educational practice grounded in Cortana&apos;s DAPA-HF sources.
        </p>
      </section>
      <div className="prime-bottom-line">
        <span>
          <strong>{prime.data?.streak ?? 0}</strong> day Cortana streak
        </span>
        <span>
          <strong>{prime.data?.stats.questions ?? 0}</strong> questions
          practiced
        </span>
        <span>
          {s?.completedAt
            ? "✓ Completed today"
            : "A little practice, every day"}
        </span>
      </div>
      {prime.data?.phoneConfigured && !s?.completedAt && (
        <Button asChild variant="ghost">
          <Link href="/prime/phone">Take Prime by phone</Link>
        </Button>
      )}
      <PrimeStats />
    </div>
  );
}
export function PrimeSessionView() {
  const prime = usePrime(),
    learning = useLearning(),
    voice = useVoice(),
    router = useRouter();
  const s = prime.data?.session,
    q = prime.data?.questions[s?.cursor ?? 0],
    grade = q ? s?.answers[q.id] : undefined;
  const [selected, setSelected] = useState(""),
    [why, setWhy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    setSelected("");
    setWhy(false);
    heading.current?.focus();
  }, [q?.id]);
  const submit = () => {
    if (s && q && selected && !grade && !prime.busy)
      void prime
        .act({
          action: "answer",
          sessionId: s.id,
          questionId: q.id,
          answer: selected,
        })
        .catch(() => {});
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        grade ||
        prime.busy ||
        !q
      )
        return;
      const target = e.target as HTMLElement;
      if (
        target.closest("input,textarea,select,button,a,[contenteditable=true]")
      )
        return;
      const index =
        ["1", "2", "3"].indexOf(e.key) >= 0
          ? Number(e.key) - 1
          : ["a", "b", "c"].indexOf(e.key.toLowerCase());
      if (index >= 0 && q.options[index]) {
        e.preventDefault();
        setSelected(q.options[index].id);
      }
      if (e.key === "Enter" && selected) {
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const leave = () => {
    if (voice.prime) voice.end();
    router.push("/prime");
  };
  const next = async () => {
    if (!s || !q) return;
    try {
      await prime.act(
        s.cursor === 2
          ? { action: "complete", sessionId: s.id }
          : { action: "next", sessionId: s.id, questionId: q.id },
      );
    } catch {}
  };
  const evidence = async (sourceId: string) => {
    if (!s || !q) return;
    try {
      await prime.act({
        action: "evidence",
        sessionId: s.id,
        questionId: q.id,
        sourceId,
      });
      learning.openEvidence(sourceId);
    } catch {}
  };
  const completed = Boolean(s?.completedAt);
  return (
    <main className="prime-focus" id="main">
      <header className="prime-focus-top">
        <Link
          href="/prime"
          onClick={() => {
            if (voice.prime) voice.end();
          }}
          className="brand"
        >
          cortana<span className="brand-period">.</span>
        </Link>
        <span className="eyebrow">PRIME</span>
        <button
          className="icon-button"
          aria-label="Save and leave Prime"
          onClick={leave}
        >
          <X size={21} />
        </button>
      </header>
      {!s || !q ? (
        <div className="prime-question">
          <h1>Preparing Prime</h1>
          <p>{prime.error ?? "Loading your saved practice…"}</p>
          <Button onClick={() => void prime.refresh()}>Retry</Button>
        </div>
      ) : !s.startedAt ? (
        <div className="prime-question">
          <h1>Ready for today&apos;s Prime?</h1>
          <Button
            onClick={() => void prime.act({ action: "start" }).catch(() => {})}
          >
            Start Prime
          </Button>
        </div>
      ) : completed ? (
        <section className="prime-completion">
          <span className="prime-complete-mark">
            <Check size={30} />
          </span>
          <p className="eyebrow">PRIME COMPLETE</p>
          <h1>
            A little sharper.
            <br />A reason to return.
          </h1>
          <p>
            3 / 3 questions practiced ·{" "}
            {Object.values(s.answers).filter((a) => a.correct).length} correct
            first attempt
          </p>
          <div className="prime-result-list">
            <h2>Concepts practiced</h2>
            {prime.data!.questions.map((item) => (
              <p key={item.id}>
                <Check size={16} />
                {conceptLabels[item.conceptIds[0]]}
                {s.answers[item.id]?.reinforced && <small>Reinforced</small>}
              </p>
            ))}
            <h2>Review next</h2>
            {prime.data!.reviews.map((review) => (
              <p key={review.conceptId}>
                {conceptLabels[review.conceptId]}
                <span>
                  {review.needsReinforcement
                    ? "Next Prime"
                    : review.nextReviewAt}
                </span>
              </p>
            ))}
          </div>
          <div className="prime-bottom-line">
            <span>{prime.data!.streak} day Cortana streak</span>
            <span>+{s.xp} XP saved</span>
          </div>
          <Button onClick={leave}>
            Done
            <ArrowRight size={16} />
          </Button>
          <p className="small muted">
            Tomorrow&apos;s Prime adapts to today&apos;s practice.
          </p>
        </section>
      ) : (
        <section className="prime-question" key={q.id}>
          <div className="prime-question-meta">
            <span>Question {s.cursor + 1} of 3</span>
            <span>{q.type.replaceAll("_", " ")}</span>
          </div>
          <div
            className="prime-progress"
            aria-label={"Question " + (s.cursor + 1) + " of 3"}
          >
            {[0, 1, 2].map((i) => (
              <span key={i} className={i <= s.cursor ? "filled" : ""} />
            ))}
          </div>
          <p className="eyebrow">
            {conceptLabels[q.conceptIds[0]]} · Heart failure
          </p>
          <h1 ref={heading} tabIndex={-1}>
            {q.prompt}
          </h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <fieldset
              className="prime-options"
              disabled={Boolean(grade) || prime.busy}
            >
              <legend className="sr-only">Choose your answer</legend>
              {q.options.map((o) => (
                <label
                  key={o.id}
                  className={
                    "prime-option" +
                    ((grade?.selectedOptionId ?? selected) === o.id
                      ? " selected"
                      : "") +
                    (grade?.correctOptionId === o.id ? " answer-correct" : "")
                  }
                >
                  <input
                    type="radio"
                    name="answer"
                    value={o.id}
                    checked={(grade?.selectedOptionId ?? selected) === o.id}
                    onChange={() => setSelected(o.id)}
                  />
                  <span className="prime-option-letter">{o.id}</span>
                  <span>{o.text}</span>
                  {grade?.correctOptionId === o.id && <Check size={18} />}
                </label>
              ))}
            </fieldset>
            {!grade && (
              <Button
                className="prime-submit"
                type="submit"
                disabled={!selected || prime.busy}
              >
                {prime.busy ? "Saving…" : "Submit answer"}
                <ArrowRight size={16} />
              </Button>
            )}
          </form>
          {grade && (
            <div
              className={
                "prime-feedback " + (grade.correct ? "is-correct" : "is-review")
              }
              role="status"
            >
              <h2>{grade.correct ? "✓ Correct" : "Review this"}</h2>
              <p>{grade.explanation}</p>
              {!grade.correct && (
                <>
                  <p>
                    <strong>Your answer:</strong>{" "}
                    {
                      q.options.find((o) => o.id === grade.selectedOptionId)
                        ?.text
                    }
                  </p>
                  <p>
                    <strong>Correct answer:</strong>{" "}
                    {
                      q.options.find((o) => o.id === grade.correctOptionId)
                        ?.text
                    }
                  </p>
                  <small>Marked for reinforcement in your next Prime.</small>
                </>
              )}
              <div className="prime-feedback-actions">
                {grade.sourceIds.map((id) => (
                  <button
                    className="text-button"
                    key={id}
                    onClick={() => void evidence(id)}
                  >
                    <BookOpen size={16} />
                    View evidence
                  </button>
                ))}
                <Button disabled={prime.busy} onClick={() => void next()}>
                  {s.cursor === 2 ? "Complete Prime" : "Continue"}
                  <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          )}
          <button
            className="text-button prime-why"
            aria-expanded={why}
            onClick={() => setWhy(!why)}
          >
            Why this question?
          </button>
          {why && (
            <p className="prime-why-copy">
              {reasons[s.selection[s.cursor].reason]}.{" "}
              {s.selection[s.cursor].contextRelevant
                ? "Relevant educational topic from today's synthetic context. "
                : ""}
              Selection uses saved practice and a transparent review schedule.
            </p>
          )}
          {prime.error && (
            <p role="alert" className="inline-error">
              {prime.error}
            </p>
          )}
        </section>
      )}
      {voice.prime &&
        (voice.connection === "connected" || voice.working || voice.error) && (
          <aside
            className="prime-voice"
            aria-label="Cortana Prime conversation"
          >
            <div>
              <strong>
                {voice.working ? "Connecting to Cortana…" : "Cortana Prime"}
              </strong>
              <button className="text-button" onClick={voice.mute}>
                {voice.muted ? "Unmute" : "Mute"}
              </button>
              <button className="text-button" onClick={voice.end}>
                End voice
              </button>
            </div>
            {voice.error && <p role="alert">{voice.error}</p>}
            <div role="log" aria-label="Prime voice transcript">
              {voice.messages.slice(-4).map((m) => (
                <p key={m.id}>
                  <strong>{m.role === "user" ? "You" : "Cortana"}</strong>{" "}
                  {m.text}
                </p>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const text = String(new FormData(form).get("message") ?? "");
                if (text.trim()) {
                  voice.send(text);
                  form.reset();
                }
              }}
            >
              <input
                name="message"
                className="input"
                aria-label="Message Cortana Prime"
                placeholder="Speak, or type your answer…"
                disabled={voice.connection !== "connected"}
              />
              <Button disabled={voice.connection !== "connected"}>Send</Button>
            </form>
          </aside>
        )}
      <footer className="prime-focus-footer">
        Evidence-grounded practice · No clinical recommendations
      </footer>
    </main>
  );
}
