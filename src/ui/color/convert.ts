/**
 * okLCH ↔ sRGB/P3 conversion and gamut mapping — the color engine's core.
 *
 * okLCH is the plugin's **canonical** color representation (SPEC §2.9/§2.14): the editor holds it, and it round-trips losslessly through a Figma Variable's code syntax. Everything Figma actually renders is a *derived*, gamut-mapped sRGB/P3 value. This module is the one place that derivation happens.
 *
 * Built on the tree-shakeable `colorjs.io/fn` API; spaces are registered once via {@link registerSpaces}. We work with colorjs.io's `PlainColorObject` (`{ space, coords, alpha }`) internally and expose plain tuples/records at the boundary so nothing colorjs-specific leaks into the contract or UI state.
 */

import {
  type ColorObject,
  getColor,
  inGamut as inGamutFn,
  type PlainColorObject,
  serialize,
  to,
  toGamutCSS
} from "colorjs.io/fn";
import { registerSpaces } from "./spaces.js";

registerSpaces();

/**
 * An okLCH color — the canonical form. `l` ∈ [0, 1] (perceptual lightness), `c` ∈ [0, ~0.4] (chroma, unbounded in theory), `h` ∈ [0, 360) (hue degrees), `alpha` ∈ [0, 1] (defaults to 1). Hue is meaningless at `c === 0` (achromatic) but we keep whatever value was authored rather than normalizing it away.
 */
export interface Oklch {
  l: number;
  c: number;
  h: number;
  alpha?: number;
}

/** An RGB(A) color with channels in [0, 1] — the shape Figma Variables store. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** The RGB gamuts a color can be mapped/tested against (the Figma-relevant ones). */
export type Gamut = "srgb" | "p3";

// Input objects use `ColorObject` (its `space` accepts the string space id); `PlainColorObject` is the resolved *output* shape colorjs returns.
const oklchToColor = ({ l, c, h, alpha = 1 }: Oklch): ColorObject => ({
  space: "oklch",
  coords: [l, c, h],
  alpha
});

const plainToOklch = (color: PlainColorObject): Oklch => {
  const [l, c, h] = color.coords;
  return {
    l: l ?? 0,
    c: c ?? 0,
    // Hue is `null` (powerless) for achromatic colors; surface 0 rather than null
    h: h ?? 0,
    alpha: color.alpha ?? 1
  };
};

const plainToRgb = (color: PlainColorObject): Rgb => {
  const [r, g, b] = color.coords;
  return { r: r ?? 0, g: g ?? 0, b: b ?? 0, a: color.alpha ?? 1 };
};

/**
 * Is this okLCH color representable within `gamut` (sRGB or P3) as-authored?
 *
 * This is the per-swatch gamut flag that drives the chart's valid-range shading and the out-of-gamut warning (SPEC §2.7). It asks the question without mutating the color: an out-of-gamut color stays exactly as authored until we choose to map it for rendering.
 */
export const inGamut = (color: Oklch, gamut: Gamut): boolean =>
  inGamutFn(oklchToColor(color), gamut);

/**
 * Derive the RGB value Figma should render for `color`, **perceptually gamut-mapped** into `gamut` via the CSS Gamut Mapping Algorithm (binary-search chroma reduction in OKLCH — not naïve channel clipping). The okLCH source is never mutated; this returns the closest in-gamut color (SPEC §2.7).
 *
 * `gamut` should follow the document's color profile: `"p3"` when the document allows it, else `"srgb"`.
 */
export const toRgb = (color: Oklch, gamut: Gamut): Rgb =>
  plainToRgb(toGamutCSS(oklchToColor(color), { space: gamut }));

/** Convert an RGB(A) value (channels in [0, 1]) back to canonical okLCH. */
export const rgbToOklch = ({ r, g, b, a }: Rgb, from: Gamut = "srgb"): Oklch =>
  plainToOklch(to({ space: from, coords: [r, g, b], alpha: a }, "oklch"));

/**
 * Serialize an okLCH color to a canonical CSS `oklch()` string — the exact form we persist in a Figma Variable's code syntax (SPEC §2.7). Round-trips with {@link parseOklch}.
 *
 * We force every coordinate to `<number>` so lightness serializes as e.g. `0.627` rather than colorjs's default `62.7%`. This keeps the persisted string uniform and trivially parseable by the sandbox (which has no colorjs), while remaining valid CSS that {@link parseOklch} round-trips.
 */
export const formatOklch = (color: Oklch): string =>
  serialize(oklchToColor(color), {
    format: "oklch",
    coords: ["<number>", "<number>", "<number>"]
  });

/**
 * Parse a CSS color string (canonically an `oklch()` one we wrote, but any CSS color works) back into canonical okLCH. The other half of the lossless code-syntax round-trip (SPEC §2.7): `parseOklch(formatOklch(c))` recovers `c`.
 *
 * Throws if the string isn't a parseable CSS color — callers reading code syntax should treat a throw as "no usable okLCH source" and fall back to the RGBA value.
 */
export const parseOklch = (css: string): Oklch =>
  plainToOklch(to(getColor(css), "oklch"));
