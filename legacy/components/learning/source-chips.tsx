import { FileText } from "lucide-react"

import { getSource } from "@/lib/content"

export function SourceChips({ sourceIds, onOpen }: { sourceIds: string[]; onOpen: (ids: string[]) => void }) {
  const sources = sourceIds.map(getSource).filter((s) => !!s)
  if (sources.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {sources.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onOpen([s.id])}
          className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs text-accent-foreground transition-colors hover:bg-accent"
        >
          <FileText className="size-3" />
          {s.shortName} · {s.year}
        </button>
      ))}
    </div>
  )
}
