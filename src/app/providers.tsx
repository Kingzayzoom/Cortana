"use client";
// Client state for the whole app. Learning is outermost because every other
// provider waits for its bootstrap (the profile cookie) before fetching.
import { LearningProvider } from "@/lib/learning/provider";
import { VoiceProvider } from "@/lib/voice/provider";
import { EvidenceDrawer } from "@/components/learning/EvidenceDrawer";
import { VoiceConsent } from "@/components/voice/VoiceControls";
import { ContextProvider } from "@/lib/context/provider";
import { PrimeProvider } from "@/lib/prime/provider";
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LearningProvider>
      <PrimeProvider>
        <ContextProvider>
          <VoiceProvider>
            {children}
            <EvidenceDrawer />
            <VoiceConsent />
          </VoiceProvider>
        </ContextProvider>
      </PrimeProvider>
    </LearningProvider>
  );
}
