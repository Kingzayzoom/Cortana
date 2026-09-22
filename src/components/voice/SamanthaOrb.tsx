"use client";
import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { useVoice } from "@/lib/voice/provider";
import { useLearning } from "@/lib/learning/provider";
import { audioTargets, smoothEnergy, visualEnergy } from "@/lib/voice/audio";
const Orb = dynamic(() => import("@/components/ui/orb").then((m) => m.Orb), {
  ssr: false,
});
function Fallback() {
  return (
    <div
      className="orb-fallback"
      role="img"
      aria-label="Simplified orb visualization"
    >
      <span>Lightweight visualization</span>
    </div>
  );
}
class OrbBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <Fallback /> : this.props.children;
  }
}
export function OrbVisual({
  getInput,
  getOutput,
  connected,
  muted,
  reducedMotion,
  listening,
  motionSpeed = 1,
  fallback = false,
}: {
  getInput: () => number;
  getOutput: () => number;
  connected: boolean;
  muted: boolean;
  reducedMotion: boolean;
  listening?: boolean;
  motionSpeed?: number;
  fallback?: boolean;
}) {
  const [supported, setSupported] = useState<boolean | null>(null),
    [visible, setVisible] = useState(true);
  const wrapper = useRef<HTMLDivElement>(null),
    input = useRef(0),
    output = useRef(0);
  const colors = useRef<[string, string]>(["#7896d6", "#af38ff"]);
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2");
      setSupported(Boolean(gl));
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      setSupported(false);
    }
    const visibility = () => setVisible(!document.hidden);
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  useEffect(() => {
    colors.current =
      listening && !muted ? ["#5bbedc", "#8b9ff1"] : ["#7896d6", "#af38ff"];
  }, [listening, muted]);
  useEffect(() => {
    if (!visible || reducedMotion) {
      input.current = 0;
      output.current = 0;
      if (wrapper.current) {
        wrapper.current.style.setProperty("--orb-scale", "1");
        wrapper.current.style.setProperty("--orb-energy", "0.45");
      }
      return;
    }
    let frame = 0,
      last = performance.now();
    const tick = (now: number) => {
      const delta = (now - last) / 1000;
      last = now;
      const targets = audioTargets(getInput(), getOutput(), muted, connected);
      input.current = smoothEnergy(input.current, targets.input, delta);
      output.current = smoothEnergy(output.current, targets.output, delta);
      const visual = visualEnergy(input.current, output.current);
      if (wrapper.current) {
        wrapper.current.style.setProperty("--orb-scale", String(visual.scale));
        wrapper.current.style.setProperty("--orb-energy", String(visual.glow));
        wrapper.current.dataset.energy = visual.energy.toFixed(3);
        wrapper.current.dataset.inputEnergy = input.current.toFixed(3);
        wrapper.current.dataset.outputEnergy = output.current.toFixed(3);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [connected, muted, reducedMotion, visible, getInput, getOutput]);
  return (
    <div
      className="orb-stage"
      ref={wrapper}
      data-testid="orb"
      aria-label="Samantha voice visualization"
      role="img"
      data-motion-speed={motionSpeed.toFixed(2)}
    >
      <div className="orb-halo" />
      <div className="orb-shadow" />
      <div className="orb-sphere">
        <OrbBoundary>
          {supported === false || fallback ? (
            <Fallback />
          ) : supported ? (
            <Orb
              seed={42}
              colors={["#7896d6", "#af38ff"]}
              colorsRef={colors}
              volumeMode="manual"
              inputVolumeRef={input}
              outputVolumeRef={output}
              reducedMotion={reducedMotion}
              active={visible}
              motionSpeed={motionSpeed}
            />
          ) : (
            <div className="orb-loading" />
          )}
        </OrbBoundary>
      </div>
    </div>
  );
}
export function SamanthaOrb() {
  const voice = useVoice(),
    { data } = useLearning();
  const [systemReduced, setSystemReduced] = useState(false);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return (
    <OrbVisual
      getInput={voice.getInputVolume}
      getOutput={voice.getOutputVolume}
      connected={voice.connection === "connected"}
      muted={voice.muted}
      reducedMotion={Boolean(
        data?.preferences.reducedMotion || systemReduced || voice.paused,
      )}
      listening={voice.activity === "user-speaking"}
      motionSpeed={
        voice.preview || voice.connection === "connected"
          ? voice.activity === "quiet"
            ? 1.12
            : 1.18
          : 1
      }
    />
  );
}
