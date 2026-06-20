/**
 * Contrast-grid model (Phase 6, SPEC §2.6) — the contrast.tools-style matrix. Pure
 * functions that compute, for a set of foreground colors against a set of background
 * colors, each pair's APCA (Lc) and WCAG verdict at a chosen typography context. No
 * React — the grid component is a thin renderer over this.
 *
 * A full N×N matrix over every swatch is both huge and mostly noise, so the caller
 * scopes it by passing explicit foreground and background sets (e.g. all swatches as
 * text against a few representative backgrounds). The font size/weight only affect
 * the pass/fail threshold, not the (pair-intrinsic) Lc, so re-filtering is cheap.
 */

import {
  apca,
  type ContrastTier,
  contrastTier,
  type Oklch,
  passesAPCA,
  wcag21
} from "../color/index.js";

/** A labeled color participating in the grid (a palette swatch or a reference). */
export interface GridColor {
  /** Stable id/label, e.g. `"red/500"` or `"white"`. */
  id: string;
  oklch: Oklch;
}

/** The contrast verdict for one foreground-on-background cell. */
export interface CellVerdict {
  /** APCA lightness contrast (signed Lc). */
  lc: number;
  /** Readability tier for the Lc. */
  tier: ContrastTier;
  /** Whether the pair passes APCA at the grid's font size/weight. */
  apcaPass: boolean;
  /** WCAG 2.x ratio. */
  ratio: number;
  /** Whether the pair clears WCAG 2 AA at the grid's font size/weight. */
  wcagPass: boolean;
}

export interface ContrastGridModel {
  foregrounds: GridColor[];
  backgrounds: GridColor[];
  /** `cells[f][b]` is the verdict for `foregrounds[f]` text on `backgrounds[b]`. */
  cells: CellVerdict[][];
}

export interface FontContext {
  sizePx: number;
  weight: number;
}

/** WCAG 2 AA: 3:1 for large text (≥24px, or ≥18.66px bold), else 4.5:1. */
const wcagAA = (ratio: number, { sizePx, weight }: FontContext): boolean => {
  const isLarge = sizePx >= 24 || (sizePx >= 18.66 && weight >= 700);
  return ratio >= (isLarge ? 3 : 4.5);
};

/** Verdict for one foreground-on-background pair at `font`. */
export const cellVerdict = (
  foreground: Oklch,
  background: Oklch,
  font: FontContext
): CellVerdict => {
  const lc = apca(foreground, background);
  const ratio = wcag21(foreground, background);
  return {
    lc,
    tier: contrastTier(lc),
    apcaPass: passesAPCA(lc, font.sizePx, font.weight),
    ratio,
    wcagPass: wcagAA(ratio, font)
  };
};

/**
 * Build the full {@link ContrastGridModel} for `foregrounds` × `backgrounds` at the
 * given typography context.
 */
export const contrastGrid = (
  foregrounds: GridColor[],
  backgrounds: GridColor[],
  font: FontContext
): ContrastGridModel => ({
  foregrounds,
  backgrounds,
  cells: foregrounds.map((fg) =>
    backgrounds.map((bg) => cellVerdict(fg.oklch, bg.oklch, font))
  )
});
