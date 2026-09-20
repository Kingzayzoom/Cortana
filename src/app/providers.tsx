"use client";
import { LearningProvider } from "@/lib/learning/provider";
import { VoiceProvider } from "@/lib/voice/provider";
import { EvidenceDrawer } from "@/components/learning/EvidenceDrawer";
import { VoiceConsent } from "@/components/voice/VoiceControls";
import { ContextProvider } from "@/lib/context/provider";
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LearningProvider>
      <ContextProvider>
      <VoiceProvider>
        {children}
        <EvidenceDrawer />
        <VoiceConsent />
      </VoiceProvider>
      </ContextProvider>
    </LearningProvider>
  );
}
