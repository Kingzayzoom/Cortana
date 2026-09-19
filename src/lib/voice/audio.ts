export function clampEnergy(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}
export function smoothEnergy(current: number, raw: number, delta: number) {
  const target = clampEnergy(raw) < 0.015 ? 0 : clampEnergy(raw);
  const tau = target > current ? 0.065 : 0.24;
  return (
    current +
    (target - current) *
      (1 - Math.exp(-Math.max(0, Math.min(delta, 0.1)) / tau))
  );
}
export function audioTargets(
  input: number,
  output: number,
  muted: boolean,
  connected: boolean,
) {
  return {
    input: connected && !muted ? clampEnergy(input) : 0,
    output: connected ? clampEnergy(output) : 0,
  };
}
export function visualEnergy(
  input: number,
  output: number,
  reducedMotion = false,
) {
  const energy = Math.max(clampEnergy(input), clampEnergy(output));
  return {
    energy,
    scale: 1 + energy * (reducedMotion ? 0 : 0.045),
    glow: 0.45 + energy * 0.35,
  };
}
