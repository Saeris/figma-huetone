/**
 * Tests for the per-channel okLCH model (Phase 4). These assert the data the sliders
 * clamp against and the histograms shade: domain clamping, track-position mapping
 * round-trips, the chroma ceiling matches the gamut boundary, and channel sampling
 * correctly flags in- vs out-of-gamut points. Pure — no DOM.
 */

import { describe, expect, it } from "vitest";
import { inGamut, maxChroma, type Oklch } from "../color/index.js";
import {
  CHANNEL_DOMAIN,
  chromaCeiling,
  clampChannel,
  fromTrackPosition,
  sampleChannel,
  toTrackPosition,
  withChannel
} from "./channel.js";

describe("channel domain + clamping", () => {
  it("clamps each channel to its domain", () => {
    expect(clampChannel("l", 1.5)).toBe(1);
    expect(clampChannel("l", -0.2)).toBe(0);
    expect(clampChannel("h", 400)).toBe(360);
    expect(clampChannel("c", 0.3)).toBe(0.3);
  });

  it("round-trips value ↔ track position", () => {
    for (const channel of ["l", "c", "h"] as const) {
      const { min, max } = CHANNEL_DOMAIN[channel];
      const mid = (min + max) / 2;
      expect(
        fromTrackPosition(channel, toTrackPosition(channel, mid))
      ).toBeCloseTo(mid, 10);
    }
    // Endpoints map to 0 and 1.
    expect(toTrackPosition("h", 0)).toBe(0);
    expect(toTrackPosition("h", 360)).toBe(1);
  });

  it("substitutes one channel, keeping the rest", () => {
    const c: Oklch = { l: 0.6, c: 0.1, h: 25, alpha: 0.5 };
    expect(withChannel(c, "l", 0.8)).toEqual({
      l: 0.8,
      c: 0.1,
      h: 25,
      alpha: 0.5
    });
  });
});

describe("chromaCeiling", () => {
  it("matches the gamut boundary: at the ceiling in gamut, just past it out", () => {
    const color: Oklch = { l: 0.7, c: 0, h: 145 };
    const ceiling = chromaCeiling(color, "srgb");
    expect(ceiling).toBe(maxChroma(color.l, color.h, "srgb").c);
    expect(inGamut({ ...color, c: ceiling }, "srgb")).toBe(true);
    expect(inGamut({ ...color, c: ceiling + 0.02 }, "srgb")).toBe(false);
  });

  it("gives a P3 ceiling at least as large as the sRGB one", () => {
    const color: Oklch = { l: 0.7, c: 0, h: 145 };
    expect(chromaCeiling(color, "p3")).toBeGreaterThanOrEqual(
      chromaCeiling(color, "srgb")
    );
  });
});

describe("sampleChannel", () => {
  it("returns one in/out-of-gamut flag per sample across the domain", () => {
    const color: Oklch = { l: 0.7, c: 0.1, h: 145 };
    const samples = sampleChannel(color, "c", "srgb", 32);
    expect(samples).toHaveLength(32);
    // Chroma 0 is always in gamut; chroma 0.5 (domain max) is not, for this color.
    expect(samples[0]).toEqual({ value: 0, inGamut: true });
    expect(samples.at(-1)?.inGamut).toBe(false);
  });

  it("marks the lightness band: very light + chromatic is out of sRGB", () => {
    // A chromatic color whose light end exceeds sRGB but whose mid-tones fit.
    const color: Oklch = { l: 0.5, c: 0.13, h: 145 };
    const samples = sampleChannel(color, "l", "srgb", 32);
    const lightest = samples.at(-1);
    expect(lightest?.value).toBeCloseTo(1, 5);
    expect(lightest?.inGamut).toBe(false);
    // Some mid-tone sample holds this chroma.
    expect(samples.some((s) => s.inGamut)).toBe(true);
  });
});
