import { notFound } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { Dashboard } from "@/components/dashboard/Dashboard";
import {
  RoundsView,
  EvidenceView,
  ProfileView,
  TopicsView,
} from "@/components/learning/SupportingViews";
import { SettingsView } from "@/components/learning/SettingsView";
import { ImpiricusSignalBridge } from "@/components/learning/ImpiricusSignalBridge";
import { PhoneRoundView } from "@/components/phone/PhoneRoundView";
export default async function Page({
  params,
}: {
  params: Promise<{ view?: string[] }>;
}) {
  const { view } = await params;
  const route = view?.join("/") || "";
  const screens: Record<string, React.ReactNode> = {
    "": <Dashboard />,
    rounds: <RoundsView />,
    evidence: <EvidenceView />,
    profile: <ProfileView />,
    topics: <TopicsView />,
    phone: <PhoneRoundView />,
    settings: <SettingsView />,
    impiricus: <ImpiricusSignalBridge />,
  };
  if (!(route in screens)) notFound();
  return <Shell>{screens[route]}</Shell>;
}
