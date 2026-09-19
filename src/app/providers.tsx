"use client";
import { LearningProvider } from "@/lib/learning/provider";
import { VoiceProvider } from "@/lib/voice/provider";
import { EvidenceDrawer } from "@/components/learning/EvidenceDrawer";
import { VoiceConsent } from "@/components/voice/VoiceControls";
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LearningProvider>
      <VoiceProvider>
        {children}
        <EvidenceDrawer />
        <VoiceConsent />
      </VoiceProvider>
    </LearningProvider>
  );
}
