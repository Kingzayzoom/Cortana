import type { Metadata } from "next"

import { EvidenceLibrary } from "@/components/evidence/evidence-library"
import { PageHeader } from "@/components/layout/page-header"

export const metadata: Metadata = { title: "Evidence Library" }

export default function EvidencePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Evidence library"
        title="Curated sources behind every round"
        description="Every answer in a round is grounded in these sources. Summaries are paraphrased — open the original for the full text."
      />
      <EvidenceLibrary />
    </main>
  )
}
