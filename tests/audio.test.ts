import { describe, expect, it } from "vitest";
import {
  audioTargets,
  smoothEnergy,
  visualEnergy,
} from "../src/lib/voice/audio";
describe("real audio adapter", () => {
  it("keeps silence at zero, with no invented activity", () => {
    expect(audioTargets(0, 0, false, true)).toEqual({ input: 0, output: 0 });
    expect(smoothEnergy(0, 0.01, 0.016)).toBe(0);
  });
  it("shows different energy for soft and strong speech", () =>
    expect(visualEnergy(0.8, 0).scale).toBeGreaterThan(
      visualEnergy(0.1, 0).scale,
    ));
  it("uses output independently while input is muted", () =>
    expect(audioTargets(0.9, 0.7, true, true)).toEqual({
      input: 0,
      output: 0.7,
    }));
  it("disconnect and invalid samples cannot produce audio energy", () => {
    expect(audioTargets(1, 1, false, false)).toEqual({ input: 0, output: 0 });
    expect(audioTargets(NaN, Infinity, false, true)).toEqual({
      input: 0,
      output: 0,
    });
  });
  it("has a faster attack than release", () => {
    const rise = smoothEnergy(0, 1, 0.065);
    const release = 1 - smoothEnergy(1, 0, 0.065);
    expect(rise).toBeGreaterThan(release);
  });
  it("is independent of frame rate", () => {
    let slow = 0,
      fast = 0;
    for (let i = 0; i < 30; i++) slow = smoothEnergy(slow, 0.8, 1 / 30);
    for (let i = 0; i < 120; i++) fast = smoothEnergy(fast, 0.8, 1 / 120);
    expect(slow).toBeCloseTo(fast, 7);
  });
  it("clamps scale under 6% and respects reduced motion", () => {
    expect(visualEnergy(100, 100).scale).toBeLessThan(1.06);
    expect(visualEnergy(1, 1, true).scale).toBe(1);
  });
});
