"use client";
// The bundled scenario catalogue with category, urgency and text filters.
// Previewing a card never changes the active scenario.
import { useState } from "react";
import {
  categoryLabels,
  urgencyLabels,
  filterScenarioCatalog,
  getBundledScenario,
  type ScenarioCategory,
  type ScenarioUrgency,
} from "@/lib/context/catalog";
import type { ContextScenario } from "@/lib/context/types";
import { SYNTHETIC_NOTICE } from "@/lib/context/selectors";
import { Button } from "@/components/ui/button";

export function ScenarioLibrary({
  onPreview,
  activeId,
}: {
  onPreview: (s: ContextScenario) => void;
  activeId?: string;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ScenarioCategory | "all">("all");
  const [urgency, setUrgency] = useState<ScenarioUrgency | "all">("all");
  const items = filterScenarioCatalog({ search, category, urgency });
  return (
    <section
      className="scenario-library"
      aria-labelledby="scenario-library-title"
    >
      <div className="context-section-heading">
        <p className="eyebrow">BUNDLED SYNTHETIC SCENARIOS</p>
        <h2 id="scenario-library-title">Choose the context.</h2>
        <p className="muted">
          15 supplied scenarios. Preview the facts, then activate one for web
          and phone.
        </p>
      </div>
      <div className="scenario-filters">
        <label className="field-label">
          Search scenarios
          <input
            className="input"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Heart failure, consult, stable…"
          />
        </label>
        <label className="field-label">
          Physician urgency
          <select
            className="input"
            value={urgency}
            onChange={(e) =>
              setUrgency(e.target.value as ScenarioUrgency | "all")
            }
          >
            <option value="all">All urgencies</option>
            {Object.entries(urgencyLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        className="scenario-categories"
        role="group"
        aria-label="Scenario category"
      >
        {(["all", "cardiology", "operations", "escalation"] as const).map(
          (value) => (
            <button
              key={value}
              className="scenario-filter"
              aria-pressed={category === value}
              onClick={() => setCategory(value)}
            >
              {value === "all" ? "All" : categoryLabels[value]}
            </button>
          ),
        )}
      </div>
      <p className="scenario-count" aria-live="polite">
        {items.length} {items.length === 1 ? "scenario" : "scenarios"} · Demo
        favorites first
      </p>
      <div className="scenario-grid">
        {items.map((item) => (
          <article
            key={item.id}
            className="panel scenario-card"
            aria-label={item.title}
          >
            <div className="scenario-card-meta">
              <span>{categoryLabels[item.category]}</span>
              {item.favorite && (
                <span className="scenario-favorite">Demo favorite</span>
              )}
            </div>
            <h3>{item.title}</h3>
            <span className={`scenario-urgency urgency-${item.urgency}`}>
              {urgencyLabels[item.urgency]}
            </span>
            <p className="scenario-unit">
              {item.specialty} · {item.unit}
            </p>
            <p className="scenario-summary">{item.summary}</p>
            <p className="context-notice">{SYNTHETIC_NOTICE}</p>
            <div className="scenario-card-footer">
              <Button
                variant="secondary"
                onClick={() => {
                  const s = getBundledScenario(item.id);
                  if (s) onPreview(s);
                }}
              >
                Preview
              </Button>
              {activeId === item.id && (
                <span className="context-valid">Active scenario</span>
              )}
            </div>
          </article>
        ))}
      </div>
      {!items.length && (
        <div className="panel scenario-empty">
          <p>No scenarios match these filters.</p>
          <Button
            variant="ghost"
            onClick={() => {
              setSearch("");
              setCategory("all");
              setUrgency("all");
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
    </section>
  );
}
