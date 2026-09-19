"use client";
import { ExternalLink, BookOpen, CalendarDays, FileText } from "lucide-react";
import { useLearning } from "@/lib/learning/provider";
import { sourceById, sources } from "@/lib/content/round";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
export function EvidenceDrawer() {
  const { evidence, openEvidence } = useLearning();
  const source = evidence ? sourceById(evidence) : null;
  return (
    <Dialog
      open={Boolean(source)}
      onOpenChange={(open) => {
        if (!open) openEvidence(null);
      }}
      title="The evidence, in context"
      description="The original sources behind this learning round."
      drawer
    >
      {source && (
        <>
          <div className="evidence-tabs">
            {sources.map((s) => (
              <button
                key={s.id}
                aria-pressed={s.id === source.id}
                onClick={() => openEvidence(s.id)}
              >
                {s.id === "dapa-hf" ? "The trial" : "Diabetes analysis"}
              </button>
            ))}
          </div>
          <span className="source-publisher">
            <BookOpen size={16} />
            {source.publisher}
          </span>
          <h3 className="source-title">{source.title}</h3>
          <p className="small muted">{source.authors}</p>
          <p className="small muted">{source.type}</p>
          <p className="source-date">
            <CalendarDays size={15} />
            Published {source.date}
          </p>
          <div className="evidence-section">
            <h4>
              <FileText size={16} />
              Relevant section
            </h4>
            <p>{source.section}</p>
          </div>
          <div className="evidence-section">
            <h4>Supporting excerpt</h4>
            <blockquote>“{source.excerpt}”</blockquote>
          </div>
          <div className="evidence-section">
            <h4>What it supports</h4>
            <p>{source.summary}</p>
          </div>
          <div className="scope-note">
            <h4>Keep the scope in view</h4>
            <p>{source.scope}</p>
          </div>
          <Button asChild>
            <a href={source.url} target="_blank" rel="noreferrer">
              Read the original source
              <ExternalLink size={16} />
            </a>
          </Button>
          <p className="small muted evidence-footer">
            Curated for this prototype · Content version 2026-09-19.1
            <br />
            Source checked; no independent clinical review claimed.
          </p>
        </>
      )}
    </Dialog>
  );
}
