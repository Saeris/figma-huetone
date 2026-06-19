/**
 * Tests for the color engine. These assert the GUARANTEES the rest of the plugin relies on — not just that colorjs.io works:
 *
 * - okLCH ⇄ `oklch()` string round-trips **losslessly** (the whole reason we persist okLCH in code syntax instead of hex — SPEC §2.7);
 * - the okLCH → RGBA derivation is **perceptually gamut-mapped**, so an out-of-sRGB color is brought *into* gamut rather than left invalid or naïvely clipped, while the okLCH source is left untouched;
 * - `inGamut` flags the out-of-gamut case the UI warns on;
 * - APCA is signed/polarity-sensitive and WCAG is a symmetric ratio — the two measures we must never conflate.
 */

import { describe, expect, it } from "vitest";
import {
  apca,
  formatOklch,
  inGamut,
  type Oklch,
  parseOklch,
  rgbToOklch,
  toRgb,
  wcag21
} from "./index.js";

const close = (a: number, b: number, eps = 1e-12): boolean =>
  Math.abs(a - b) < eps;

describe("okLCH code-syntax round-trip", () => {
  it("recovers an okLCH color exactly through format → parse", () => {
    // This is the precision property Huetone loses by serializing to hex. A representative in-gamut color with non-trivial digits in every channel.
    const original: Oklch = { l: 0.627, c: 0.21, h: 25.4, alpha: 1 };
    const recovered = parseOklch(formatOklch(original));

    expect(close(recovered.l, original.l)).toBe(true);
    expect(close(recovered.c, original.c)).toBe(true);
    expect(close(recovered.h, original.h)).toBe(true);
    expect(recovered.alpha).toBe(1);
  });

  it("preserves alpha through the round-trip", () => {
    const original: Oklch = { l: 0.5, c: 0.1, h: 200, alpha: 0.42 };
    const recovered = parseOklch(formatOklch(original));
    expect(close(recovered.alpha ?? 1, 0.42)).toBe(true);
  });

  it("throws on an unparseable string so callers can fall back to RGBA", () => {
    expect(() => parseOklch("not a color")).toThrow();
  });
});

describe("gamut testing", () => {
  it("flags a vivid okLCH color as outside sRGB but inside P3", () => {
    // High chroma green: representable in Display P3 but not sRGB. This is exactly the case the UI surfaces a warning for and that gamut target selection cares about (SPEC §2.7).
    const vivid: Oklch = { l: 0.86, c: 0.29, h: 142 };
    expect(inGamut(vivid, "srgb")).toBe(false);
    expect(inGamut(vivid, "p3")).toBe(true);
  });

  it("treats a muted color as in gamut for both", () => {
    const muted: Oklch = { l: 0.6, c: 0.05, h: 142 };
    expect(inGamut(muted, "srgb")).toBe(true);
    expect(inGamut(muted, "p3")).toBe(true);
  });
});

describe("okLCH → RGBA derivation (perceptual gamut map)", () => {
  it("yields in-[0,1] channels for an in-gamut color, round-tripping back", () => {
    const c: Oklch = { l: 0.627, c: 0.1, h: 25 };
    const rgb = toRgb(c, "srgb");
    for (const channel of [rgb.r, rgb.g, rgb.b]) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
    // Derivation is reversible for an in-gamut color (within sRGB 8-ish-bit noise)
    const back = rgbToOklch(rgb, "srgb");
    expect(close(back.l, c.l, 1e-3)).toBe(true);
  });

  it("maps an out-of-sRGB color INTO sRGB (chroma reduced, not left invalid)", () => {
    const vivid: Oklch = { l: 0.86, c: 0.29, h: 142 };
    expect(inGamut(vivid, "srgb")).toBe(false);

    const rgb = toRgb(vivid, "srgb");
    for (const channel of [rgb.r, rgb.g, rgb.b]) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
    // The mapped result, read back as okLCH, is now within sRGB: chroma was pulled in. (Perceptual map preserves L far better than it preserves C.)
    const mapped = rgbToOklch(rgb, "srgb");
    expect(mapped.c).toBeLessThan(vivid.c);
    expect(inGamut(mapped, "srgb")).toBe(true);
  });

  it("does not mutate the source okLCH when mapping", () => {
    const vivid: Oklch = { l: 0.86, c: 0.29, h: 142 };
    toRgb(vivid, "srgb");
    // Source is preserved — intent stays in okLCH even when the render value clips
    expect(vivid).toEqual({ l: 0.86, c: 0.29, h: 142 });
  });
});

describe("contrast", () => {
  it("aPCA is signed: dark-on-light is positive, light-on-dark negative", () => {
    const dark: Oklch = { l: 0.1, c: 0, h: 0 };
    const light: Oklch = { l: 0.98, c: 0, h: 0 };
    expect(apca(dark, light)).toBeGreaterThan(0);
    expect(apca(light, dark)).toBeLessThan(0);
  });

  it("wCAG is a symmetric ratio, ~21 for black on white", () => {
    const black: Oklch = { l: 0, c: 0, h: 0 };
    const white: Oklch = { l: 1, c: 0, h: 0 };
    const ratio = wcag21(black, white);
    expect(ratio).toBeGreaterThan(20);
    expect(close(wcag21(black, white), wcag21(white, black), 1e-9)).toBe(true);
  });
});
