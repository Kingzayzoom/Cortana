"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { ArrowDown, ArrowRight, ArrowUp, FileJson, Upload } from "lucide-react";
import { useContextScenario } from "@/lib/context/provider";
import {
  defaultCatalogScenario,
  getBundledScenario,
  urgencyLabels,
} from "@/lib/context/catalog";
import { ScenarioLibrary } from "./ScenarioLibrary";
import { parseScenarioFile, parseScenarioJSON } from "@/lib/context/normalize";
import { SYNTHETIC_NOTICE, previewBriefing } from "@/lib/context/selectors";
import type { ContextScenario } from "@/lib/context/types";
import { useVoice } from "@/lib/voice/provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PageHeading } from "@/components/learning/SupportingViews";

function BriefingActions() {
  const { activeScenario, phoneConfigured, loading, busy } =
    useContextScenario();
  const voice = useVoice();
  const router = useRouter();
  const unavailable =
    !activeScenario ||
    loading ||
    busy ||
    voice.working ||
    voice.connection === "connected";
  return (
    <div className="context-actions">
      <Button
        disabled={unavailable}
        onClick={() => {
          voice.requestStart("context");
          router.push("/");
        }}
      >
        Start briefing <ArrowRight size={16} />
      </Button>
      {phoneConfigured && activeScenario ? (
        <Button asChild variant="secondary">
          <Link href="/context/phone">Call me with briefing</Link>
        </Button>
      ) : (
        <Button
          variant="secondary"
          disabled
          title="Phone integration must be configured and a scenario active"
        >
          Call me with briefing
        </Button>
      )}
    </div>
  );
}
export function ContextFeedCard() {
  const { activeScenario: s, loading, error } = useContextScenario();
  return (
    <section
      className="panel context-card"
      aria-labelledby="context-card-title"
    >
      <div className="context-card-heading">
        <div>
          <p className="eyebrow">DEMO CONTEXT FEED</p>
          <h2 id="context-card-title">
            {loading
              ? "Loading context…"
              : s
                ? s.facility.unit
                : "No active scenario"}
          </h2>
        </div>
        <Link className="text-button" href="/context">
          Review context <ArrowRight size={16} />
        </Link>
      </div>
      <p className="context-notice">{SYNTHETIC_NOTICE}</p>
      {error && <p role="alert">{error}</p>}
      {s && (
        <>
          <p>
            {s.shift.startTime} · {s.clinician.displayName} ·{" "}
            {s.primaryCase?.displayName ?? "Hospital shift"}
          </p>
          <p className="muted">
            {s.primaryCase?.changes.filter((c) => c.direction !== "stable")
              .length ?? 0}{" "}
            updates ·{" "}
            {s.primaryCase?.scheduledEvents.filter((e) => e.category === "lab")
              .length ?? 0}{" "}
            scheduled labs · {s.primaryCase?.itemsForReview.length ?? 0} items
            for review
          </p>
        </>
      )}
      <BriefingActions />
    </section>
  );
}
function ScenarioSummary({ scenario: s }: { scenario: ContextScenario }) {
  return (
    <div className="scenario-preview-summary">
      <dl className="context-facts">
        <div>
          <dt>Clinician</dt>
          <dd>{s.clinician.displayName}</dd>
        </div>
        <div>
          <dt>Hospital / unit</dt>
          <dd>
            {s.facility.displayName} · {s.facility.unit}
          </dd>
        </div>
        <div>
          <dt>Primary case</dt>
          <dd>{s.primaryCase?.displayName ?? "No primary case supplied"}</dd>
        </div>
        <div>
          <dt>Hospital status</dt>
          <dd>
            {s.hospitalStatus?.overallStatus.replaceAll("_", " ") ??
              "Not supplied"}
          </dd>
        </div>
      </dl>
      <p>{s.primaryCase?.currentStatus.summary}</p>
      <h4>Physician urgency</h4>
      {s.physicianUrgency && (
        <>
          <span
            className={`scenario-urgency urgency-${s.physicianUrgency.level}`}
          >
            {urgencyLabels[s.physicianUrgency.level]}
          </span>
          <p>
            {s.physicianUrgency.requestedBy} ·{" "}
            {s.physicianUrgency.requestedArrival}
          </p>
          <p>{s.physicianUrgency.reason}</p>
        </>
      )}
      <h4>Important changes</h4>
      <ul>
        {s.primaryCase?.changes.map((c) => (
          <li key={c.id}>{c.explanation}</li>
        ))}
      </ul>
      {!s.primaryCase?.changes.length && <p>No case changes supplied.</p>}
      <h4>Hospital context</h4>
      <p>{s.hospitalStatus?.summary}</p>
      <ul>
        {s.secondaryCases.map((c) => (
          <li key={c.id}>
            {c.displayName}: {c.currentStatus.summary}
          </li>
        ))}
      </ul>
      <h4>Timeline</h4>
      <ol className="context-timeline">
        {s.timeline.map((e) => (
          <li key={e.id}>
            <time>{e.time}</time>
            <div>
              <strong>{e.label}</strong>
              <small>{e.detail}</small>
            </div>
          </li>
        ))}
      </ol>
      <h4>Educational triggers</h4>
      <ul>
        {s.educationTriggers.map((e) => (
          <li key={e.id}>{e.topic}</li>
        ))}
      </ul>
    </div>
  );
}
function ScenarioDetails({ scenario: s }: { scenario: ContextScenario }) {
  const c = s.primaryCase;
  return (
    <div className="context-details">
      <div className="context-facts">
        <div>
          <span>Clinician</span>
          <strong>{s.clinician.displayName}</strong>
          <small>
            {s.clinician.role} · {s.clinician.specialty}
          </small>
        </div>
        <div>
          <span>Facility</span>
          <strong>{s.facility.displayName}</strong>
          <small>{s.facility.unit}</small>
        </div>
        <div>
          <span>Shift</span>
          <strong>
            {s.shift.startTime}
            {s.shift.endTime ? " – " + s.shift.endTime : ""}
          </strong>
          <small>{s.shift.date}</small>
        </div>
        <div>
          <span>Primary case</span>
          <strong>{c?.displayName ?? "No primary case supplied"}</strong>
          <small>{c?.reasonForAdmission}</small>
        </div>
      </div>
      <section
        className="panel context-card"
        aria-label="Physician urgency and hospital status"
      >
        <h3>Physician urgency</h3>
        {s.physicianUrgency ? (
          <>
            <span
              className={`scenario-urgency urgency-${s.physicianUrgency.level}`}
            >
              {urgencyLabels[s.physicianUrgency.level]}
            </span>
            <p>
              <strong>{s.physicianUrgency.requestedBy}</strong> ?{" "}
              {s.physicianUrgency.requestedArrival}
            </p>
            <p>{s.physicianUrgency.reason}</p>
          </>
        ) : (
          <p className="muted">Physician urgency not supplied.</p>
        )}
        <h4>Hospital status</h4>
        {s.hospitalStatus ? (
          <>
            <p>
              <strong>
                {s.hospitalStatus.overallStatus.replaceAll("_", " ")}
              </strong>{" "}
              ? {s.hospitalStatus.summary}
            </p>
            <ul className="context-timeline">
              {s.hospitalStatus.events.map((e) => (
                <li key={e.id}>
                  <time>{e.time}</time>
                  <div>
                    <strong>{e.label}</strong>
                    <small>{e.detail}</small>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted">Hospital status not supplied.</p>
        )}
      </section>
      {s.secondaryCases.length > 0 && (
        <section className="panel context-card">
          <h3>Other synthetic cases</h3>
          <ul>
            {s.secondaryCases.map((item) => (
              <li key={item.id}>
                <strong>{item.displayName}</strong> ?{" "}
                {item.currentStatus.summary}
                {item.physicianUrgency && (
                  <p>
                    {urgencyLabels[item.physicianUrgency.level]} ?{" "}
                    {item.physicianUrgency.requestedBy} ?{" "}
                    {item.physicianUrgency.requestedArrival}
                  </p>
                )}
                {item.scheduledEvents.map((e) => (
                  <p key={e.id}>
                    {e.time} ? {e.label} ? {e.status}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="context-columns">
        <section className="panel context-card">
          <p className="eyebrow">SINCE LAST REVIEW</p>
          <h3>What changed?</h3>
          {c?.changes.length ? (
            <ul className="context-changes">
              {c.changes.map((change) => (
                <li key={change.id}>
                  <span
                    className={
                      "context-direction direction-" + change.direction
                    }
                  >
                    {change.direction === "up" ? (
                      <ArrowUp size={20} />
                    ) : change.direction === "down" ? (
                      <ArrowDown size={20} />
                    ) : (
                      <ArrowRight size={20} />
                    )}
                  </span>
                  <div>
                    <strong>
                      {change.concept} <small>{change.direction}</small>
                    </strong>
                    {(change.previous !== undefined ||
                      change.current !== undefined) && (
                      <p className="context-value">
                        {change.previous ?? "Not supplied"} →{" "}
                        {change.current ?? "Not supplied"} {change.unit}
                      </p>
                    )}
                    <p>{change.explanation}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No case changes supplied.</p>
          )}
        </section>
        <section className="panel context-card">
          <p className="eyebrow">UP NEXT</p>
          <h3>Schedule & review</h3>
          {c?.scheduledEvents.length ? (
            <ul className="context-timeline">
              {c.scheduledEvents.map((e) => (
                <li key={e.id}>
                  <time>{e.time}</time>
                  <div>
                    <strong>{e.label}</strong>
                    <small>
                      {e.category} · {e.status}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No case schedule supplied.</p>
          )}
          <h4>Items for review</h4>
          {c?.itemsForReview.length ? (
            <ul>
              {c.itemsForReview.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">No review items supplied.</p>
          )}
        </section>
        <section className="panel context-card">
          <p className="eyebrow">SUPPLIED EVENTS</p>
          <h3>Timeline</h3>
          {s.timeline.length ? (
            <ol className="context-timeline">
              {s.timeline.map((e) => (
                <li key={e.id}>
                  <time>{e.time}</time>
                  <div>
                    <strong>{e.label}</strong>
                    {e.detail && <small>{e.detail}</small>}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">No timeline supplied.</p>
          )}
          {s.hospitalEvents.length > 0 && (
            <>
              <h4>Hospital events</h4>
              <ul className="context-timeline">
                {s.hospitalEvents.map((e) => (
                  <li key={e.id}>
                    <time>{e.time}</time>
                    <div>
                      <strong>{e.label}</strong>
                      <small>{e.detail}</small>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section className="panel context-card">
          <p className="eyebrow">CONTEXT → EDUCATIONAL ENGAGEMENT</p>
          <h3>A reason to learn</h3>
          {s.educationTriggers.length ? (
            s.educationTriggers.map((e) => (
              <div className="context-education" key={e.id}>
                <strong>{e.topic}</strong>
                <p>{e.reason}</p>
                {e.roundId === "dapa-hf-01" ? (
                  <Link className="text-button" href="/">
                    Explore heart-failure evidence <ArrowRight size={15} />
                  </Link>
                ) : (
                  <small>No reviewed round is linked to this trigger.</small>
                )}
              </div>
            ))
          ) : (
            <p className="muted">No educational triggers supplied.</p>
          )}
          <p className="small muted">
            Educational context only. No treatment recommendations.
          </p>
          {s.consults.length > 0 && (
            <>
              <h4>Consults</h4>
              <ul>
                {s.consults.map((c) => (
                  <li key={c.id}>
                    {c.time} · {c.specialty}: {c.reason} ({c.status})
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
      {c && (
        <details className="panel context-card">
          <summary>Case history, vitals & labs</summary>
          <p>{c.currentStatus.summary}</p>
          <ul>
            {c.history.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
          <dl className="context-facts">
            {Object.entries(c.currentStatus.vitals ?? {}).map(
              ([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value}</dd>
                </div>
              ),
            )}
          </dl>
          <ul>
            {c.labs.map((l) => (
              <li key={l.id}>
                {l.name}: {l.value} {l.unit}
                {l.previous !== undefined
                  ? " (previous: " + l.previous + ")"
                  : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
      <details className="panel context-card">
        <summary>Normalized scenario JSON</summary>
        <pre className="context-json">{JSON.stringify(s, null, 2)}</pre>
      </details>
    </div>
  );
}
export function ContextFeedView() {
  const context = useContextScenario();
  const [draft, setDraft] = useState<ContextScenario | null>(null);
  const [raw, setRaw] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState(false);
  const [catalogPreview, setCatalogPreview] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const previewTrigger = useRef<HTMLElement | null>(null);
  const s = draft ?? context.activeScenario;
  const invalid = (e: unknown) => {
    setDraft(null);
    setNotice("");
    setIssues(
      e instanceof z.ZodError
        ? e.issues.map(
            (i) => (i.path.join(".") || "scenario") + ": " + i.message,
          )
        : [e instanceof Error ? e.message : "Scenario could not be read."],
    );
  };
  const validated = (scenario: ContextScenario) => {
    setDraft(scenario);
    setIssues([]);
    setNotice("Valid Cortana context scenario");
  };
  const file = async (files: FileList | null) => {
    if (!files?.length) return;
    if (files.length !== 1) {
      invalid(new Error("Choose one JSON scenario at a time."));
      return;
    }
    try {
      validated(await parseScenarioFile(files[0]));
    } catch (e) {
      invalid(e);
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="Demo context feed"
        title="A little context. A clearer conversation."
        description="Drop in a synthetic scenario. Review the changes, then let Cortana brief you."
      />
      <p className="context-notice">{SYNTHETIC_NOTICE}</p>
      <section className="context-active-bar" aria-label="Active context">
        <div>
          <span className="eyebrow">ACTIVE FOR WEB + PHONE</span>
          <strong>
            {context.loading
              ? "Loading…"
              : (context.activeScenario?.title ?? "No active scenario")}
          </strong>
        </div>
        <BriefingActions />
      </section>
      <ScenarioLibrary
        activeId={context.activeScenario?.id}
        onPreview={(scenario) => {
          previewTrigger.current = document.activeElement as HTMLElement;
          validated(scenario);
          setCatalogPreview(true);
        }}
      />
      <section
        className="panel context-card context-import"
        aria-labelledby="drop-in-title"
      >
        <div>
          <h2 id="drop-in-title">Context Drop-In</h2>
          <p className="muted">
            One active scenario, shared by web and phone Cortana.
          </p>
        </div>
        <div
          className={"context-dropzone" + (dragging ? " is-dragging" : "")}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void file(e.dataTransfer.files);
          }}
        >
          <FileJson size={26} />
          <strong>Drop a JSON scenario here</strong>
          <span>JSON only · up to 64 KB · synthetic data only</span>
          <Button
            variant="secondary"
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={16} /> Upload JSON
          </Button>
          <input
            ref={fileInput}
            aria-label="Upload JSON scenario"
            type="file"
            accept=".json,application/json"
            className="context-file-input"
            onChange={(e) => {
              void file(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        <details>
          <summary>Paste JSON instead</summary>
          <label className="field-label" htmlFor="scenario-json">
            Scenario JSON
          </label>
          <textarea
            id="scenario-json"
            className="input context-textarea"
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setDraft(null);
              setNotice("");
              setIssues([]);
            }}
            spellCheck={false}
            placeholder='{"schemaVersion":"1.0", …}'
          />
          <Button
            variant="secondary"
            disabled={!raw.trim()}
            onClick={() => {
              try {
                validated(parseScenarioJSON(raw));
              } catch (e) {
                invalid(e);
              }
            }}
          >
            Validate JSON
          </Button>
        </details>
        {issues.length > 0 && (
          <div role="alert" className="inline-error">
            <strong>Scenario could not be validated</strong>
            <ul>
              {issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          </div>
        )}
        {notice && (
          <p role="status" className="context-valid">
            ✓ {notice}
          </p>
        )}
        {context.error && (
          <p role="alert" className="inline-error">
            {context.error}
          </p>
        )}
        <div className="context-actions">
          <Button
            disabled={!draft || context.busy || context.loading}
            onClick={async () => {
              if (!draft) return;
              try {
                await context.setActiveScenario(draft);
                setDraft(null);
                setNotice("Scenario activated for web and phone.");
              } catch {}
            }}
          >
            {context.busy ? "Saving…" : "Activate scenario"}
          </Button>
          <Button
            variant="secondary"
            disabled={!s}
            onClick={() => setPreview(true)}
          >
            Preview briefing
          </Button>
          <Button
            variant="secondary"
            disabled={context.busy || context.loading}
            onClick={async () => {
              const scenario = getBundledScenario(defaultCatalogScenario.id);
              if (!scenario) return;
              try {
                await context.setActiveScenario(scenario);
                setDraft(null);
                setNotice(
                  "Demo reset. Default scenario activated for web and phone.",
                );
              } catch {}
            }}
          >
            Reset demo context
          </Button>
          <Button
            variant="ghost"
            disabled={!context.activeScenario || context.busy}
            onClick={async () => {
              try {
                await context.clearScenario();
                setDraft(null);
                setNotice(
                  "Context cleared. Tools will report missing information.",
                );
              } catch {}
            }}
          >
            Clear active context
          </Button>
        </div>
      </section>
      {s && (
        <section
          aria-label={draft ? "Scenario preview" : "Active scenario details"}
        >
          <div className="context-section-heading">
            <p className="eyebrow">
              {draft
                ? "VALIDATED PREVIEW · ACTIVATE TO USE"
                : "ACTIVE SCENARIO"}
            </p>
            <h2>{s.title}</h2>
            <p>{s.description}</p>
            <p className="context-notice">{SYNTHETIC_NOTICE}</p>
          </div>
          <ScenarioDetails scenario={s} />
        </section>
      )}
      <Dialog
        open={catalogPreview}
        onOpenChange={setCatalogPreview}
        title="Scenario summary"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          previewTrigger.current?.focus();
        }}
        description={SYNTHETIC_NOTICE}
        drawer
      >
        {draft && (
          <>
            <h3>{draft.title}</h3>
            <p>{draft.description}</p>
            <ScenarioSummary scenario={draft} />
            {context.error && <p role="alert">{context.error}</p>}
            <Button
              disabled={context.busy || context.loading}
              onClick={async () => {
                try {
                  await context.setActiveScenario(draft);
                  setDraft(null);
                  setCatalogPreview(false);
                  setNotice("Scenario activated for web and phone.");
                } catch {}
              }}
            >
              {context.busy ? "Saving?" : "Activate scenario"}
            </Button>
          </>
        )}
      </Dialog>
      <Dialog
        open={preview}
        onOpenChange={setPreview}
        title="Briefing preview"
        description={SYNTHETIC_NOTICE}
      >
        <p>{previewBriefing(s)}</p>
        <p className="small muted">
          Text preview from the supplied fields. Live voice can phrase these
          facts conversationally.
        </p>
      </Dialog>
    </>
  );
}
