"use client"

import { useEffect } from "react"
import { ExternalLink, TriangleAlert, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getSource, type ReviewStatus } from "@/lib/content"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  sourceIds: string[]
  review?: ReviewStatus
  onClose: () => void
}

/**
 * Non-modal side panel: it sits over the page without unmounting anything,
 * so an active voice conversation keeps running while it's open.
 */
export function EvidenceDrawer({ open, sourceIds, review, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const sources = sourceIds.map(getSource).filter((s) => !!s)

  return (
    <aside
      role="complementary"
      aria-label="Evidence"
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l bg-card shadow-2xl transition-transform duration-300 ease-out",
        open ? "translate-x-0" : "translate-x-full",
      )}
    >
      <header className="flex items-center justify-between border-b px-5 py-4">
        <p className="eyebrow">Evidence</p>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close evidence">
          <X />
        </Button>
      </header>

      <div className="flex-1 space-y-8 overflow-y-auto px-5 py-5">
        {review?.status === "draft" && (
          <p className="flex gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-[oklch(0.45_0.1_60)]">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            {review.note}
          </p>
        )}

        {sources.map((s) => (
          <article key={s.id} className="space-y-4">
            <div className="space-y-1.5">
              <Badge>{s.kind}</Badge>
              <h3 className="text-base leading-snug font-semibold">{s.title}</h3>
              <p className="text-xs text-muted-foreground">{s.authors}</p>
              <p className="text-xs text-muted-foreground">
                {s.publisher} · {s.year} · {s.citation}
              </p>
            </div>

            <div>
              <p className="eyebrow mb-1">Relevant section</p>
              <p className="text-sm">{s.section}</p>
            </div>

            <div>
              <p className="eyebrow mb-1">Summary (paraphrased)</p>
              <p className="border-l-2 border-primary/40 pl-3 text-sm leading-relaxed text-foreground/85">{s.summary}</p>
            </div>

            <div>
              <p className="eyebrow mb-1">Limitations</p>
              <ul className="space-y-1 text-sm text-foreground/80">
                {s.limitations.map((l) => (
                  <li key={l} className="flex gap-2">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-warning" />
                    {l}
                  </li>
                ))}
              </ul>
            </div>

            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View original source <ExternalLink className="size-3.5" />
            </a>
          </article>
        ))}
      </div>
    </aside>
  )
}
