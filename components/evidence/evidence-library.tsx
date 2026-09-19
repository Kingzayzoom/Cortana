"use client"

import { useState } from "react"
import { ArrowRight, Search } from "lucide-react"

import { EvidenceDrawer } from "@/components/learning/evidence-drawer"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { listSources, roundsUsingSource } from "@/lib/content"

// Searches the curated bundle only. This is not a general medical search engine.
export function EvidenceLibrary() {
  const [query, setQuery] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)

  const q = query.trim().toLowerCase()
  const sources = listSources().filter(
    (s) => !q || [s.title, s.shortName, s.publisher, s.summary, ...s.keyPoints].some((t) => t.toLowerCase().includes(q)),
  )
  const openRound = openId ? roundsUsingSource(openId)[0] : undefined

  return (
    <>
      <label className="mb-6 flex max-w-md items-center gap-2 rounded-full border bg-card px-4 py-2 shadow-sm focus-within:ring-3 focus-within:ring-ring/30">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search curated evidence…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>

      <p className="eyebrow mb-3">Cardiology</p>
      {sources.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sources match “{query}”.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {sources.map((s) => (
            <Card key={s.id} className="flex flex-col p-5">
              <Badge className="mb-2 self-start">{s.kind}</Badge>
              <p className="leading-snug font-medium">{s.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {s.publisher} · {s.year}
              </p>
              <p className="mt-3 line-clamp-3 text-sm text-foreground/80">{s.summary}</p>
              <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                <p className="text-xs text-muted-foreground">
                  Used in: {roundsUsingSource(s.id).map((r) => `${r.title} round`).join(", ") || "—"}
                </p>
                <button
                  type="button"
                  onClick={() => setOpenId(s.id)}
                  className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  View source <ArrowRight className="size-3.5" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <EvidenceDrawer open={openId !== null} sourceIds={openId ? [openId] : []} review={openRound?.review} onClose={() => setOpenId(null)} />
    </>
  )
}
