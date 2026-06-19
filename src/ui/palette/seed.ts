/**
 * Default starter palette (SPEC §2.12): a small Tailwind/Radix-shaped seed so a
 * fresh document opens with something to edit rather than a blank grid. Full
 * user-configurable axes (add/remove/reorder groups and scales) arrive in Phase 3;
 * this is just the out-of-the-box content.
 *
 * Each ramp is generated in okLCH: lightness steps down a fixed curve across the
 * scale while hue stays fixed and chroma peaks in the mid-tones — the standard
 * perceptual ramp shape. Chroma is expressed as a FRACTION of the maximum in-gamut
 * chroma at each step's lightness/hue (light tints and dark shades can hold far less
 * chroma than mid-tones), so the seed is always in sRGB and never starts out-of-
 * gamut, regardless of hue.
 */

import { maxChroma, type Oklch } from "../color/index.js";

/** The seed scale steps — the Tailwind/Radix-style columns Shadcn expects. */
export const SEED_SCALES = [
  "50",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
  "950"
] as const;

/** Per-step lightness (okLCH L, 0–1), lightest → darkest across {@link SEED_SCALES}. */
const SEED_LIGHTNESS = [
  0.97, 0.94, 0.88, 0.8, 0.7, 0.62, 0.55, 0.48, 0.4, 0.32, 0.24
];

/**
 * Per-step chroma as a fraction (0–1) of the maximum in-gamut chroma at that step:
 * low at the light/dark ends, full saturation in the mid-tones. A `saturation`
 * factor (per hue) scales the whole curve down for muted families like neutral.
 */
const CHROMA_CURVE = [0.25, 0.4, 0.6, 0.8, 0.95, 1, 0.95, 0.85, 0.7, 0.55, 0.4];

/** The seed hue groups: name → (hue°, overall saturation 0–1). */
const SEED_HUES: Record<string, { h: number; saturation: number }> = {
  red: { h: 25, saturation: 0.9 },
  amber: { h: 70, saturation: 0.9 },
  green: { h: 145, saturation: 0.85 },
  blue: { h: 255, saturation: 0.9 },
  neutral: { h: 270, saturation: 0.06 }
};

/**
 * A `{ scale: okLCH }` ramp for one hue group. Each step takes `saturation × curve`
 * of the in-gamut max chroma at its lightness/hue, guaranteeing sRGB validity.
 */
const seedRamp = (h: number, saturation: number): Record<string, Oklch> =>
  Object.fromEntries(
    SEED_SCALES.map((scale, i) => {
      const l = SEED_LIGHTNESS[i];
      const ceiling = maxChroma(l, h, "srgb").c;
      return [scale, { l, c: ceiling * saturation * CHROMA_CURVE[i], h }];
    })
  );

/**
 * The full seed palette as `{ group: { scale: okLCH } }`. The caller writes each
 * entry through the normal edit path (so it persists as RGBA + okLCH code syntax
 * like any other swatch).
 */
export const seedPalette = (): Record<string, Record<string, Oklch>> =>
  Object.fromEntries(
    Object.entries(SEED_HUES).map(([name, { h, saturation }]) => [
      name,
      seedRamp(h, saturation)
    ])
  );
