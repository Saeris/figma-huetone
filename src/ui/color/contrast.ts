/**
 * Contrast — APCA (Lc) and WCAG 2.x, computed from okLCH pairs.
 *
 * The two are fundamentally different measures and we never blend or average them (SPEC §2.5; CLAUDE Rule 7): APCA returns a *signed* lightness contrast (Lc, roughly ±108, sign = polarity) whose meaning depends on font size + weight; WCAG returns a *ratio* (1–21) compared against flat thresholds. We expose both, clearly separated, and leave the typography lookup (Lc → pass/fail per size and weight) to a later phase's font-lookup table.
 *
 * colorjs.io provides both algorithms directly, so we don't vendor `apca-w3`.
 */

import { type ColorObject, contrastAPCA, contrastWCAG21 } from "colorjs.io/fn";
import { registerSpaces } from "./spaces.js";
import type { Oklch } from "./convert.js";

registerSpaces();

const toColor = ({ l, c, h, alpha = 1 }: Oklch): ColorObject => ({
  space: "oklch",
  coords: [l, c, h],
  alpha
});

/**
 * APCA lightness contrast (Lc) of `text` against `background`.
 *
 * **Signed and order-sensitive** — unlike WCAG, polarity matters: dark text on a light background yields a positive Lc, light-on-dark a negative one, with different perceptual weighting for each. Pass foreground and background in the right roles; don't take the absolute value here (the font lookup decides what the magnitude means). Range ≈ −108…+106.
 */
export const apca = (text: Oklch, background: Oklch): number =>
  contrastAPCA(toColor(background), toColor(text));

/**
 * WCAG 2.x contrast **ratio** of two colors (1–21). Symmetric — order doesn't matter — and compared against flat thresholds (4.5:1 normal text, 3:1 large/UI). Provided alongside APCA for teams still certifying against WCAG 2 AA.
 */
export const wcag21 = (a: Oklch, b: Oklch): number =>
  contrastWCAG21(toColor(a), toColor(b));
