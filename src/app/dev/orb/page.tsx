import { notFound } from "next/navigation";
import { OrbHarness } from "@/components/voice/OrbHarness";
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <OrbHarness />;
}
