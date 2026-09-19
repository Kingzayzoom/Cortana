import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { LearningProfile } from "@/components/profile/learning-profile"

export const metadata: Metadata = { title: "Learning Profile" }

export default function ProfilePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader eyebrow="Learning profile" title="Your practice, not a mastery score" />
      <LearningProfile />
    </main>
  )
}
