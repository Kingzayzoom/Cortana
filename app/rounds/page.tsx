import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { MyRounds } from "@/components/rounds/my-rounds"

export const metadata: Metadata = { title: "My Rounds" }

export default function RoundsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader eyebrow="My rounds" title="Your clinical conversations" />
      <MyRounds />
    </main>
  )
}
