/**
 * The APCA font-lookup table (SPEC §2.5) — the data that turns a raw Lc value into
 * the answer that actually matters: "is this contrast enough for THIS font size and
 * weight?". APCA is not a pass/fail ratio like WCAG; legibility depends on
 * typography, so a contrast of, say, Lc 60 is fine for large bold text but not for
 * small body text. This table encodes those thresholds.
 *
 * The table mirrors `apca-w3`'s `fontLookupAPCA`: rows are Lc levels (descending),
 * columns are the nine CSS font weights 100–900, and each cell is the MINIMUM font
 * size in px that is legible at that Lc for that weight. `999` marks a
 * weight/contrast combination that is never acceptable (use a higher contrast).
 * Reference: https://github.com/Myndex/SAPC-APCA and the APCA Readability Criterion.
 */

/** The nine CSS font weights the lookup table is indexed by. */
export const FONT_WEIGHTS = [
  100, 200, 300, 400, 500, 600, 700, 800, 900
] as const;
export type FontWeight = (typeof FONT_WEIGHTS)[number];

/** A sentinel min-size meaning "no acceptable size — raise the contrast". */
export const NEVER = 999;

/**
 * Rows of `[Lc, ...minSizePxForEachWeight]`, descending by Lc. Derived from the APCA
 * `fontLookupAPCA` matrix. To read it: find the highest Lc row whose level is ≤ your
 * absolute Lc, then the min legible size for your weight is that row's column.
 */
const TABLE: ReadonlyArray<readonly [number, ...number[]]> = [
  // Lc    100   200   300   400   500   600   700   800   900
  [100, 12, 11, 10, 9, 8, 8, 8, 8, 8],
  [95, 14, 12, 11, 10, 9, 9, 9, 9, 9],
  [90, 16, 14, 12, 11, 10, 10, 10, 10, 10],
  [85, 17, 15, 13, 12, 11, 11, 11, 11, 11],
  [80, 18, 16, 14, 13, 12, 12, 12, 12, 12],
  [75, 20, 18, 16, 14, 13, 13, 13, 13, 13],
  [70, 22, 19, 17, 15, 14, 14, 14, 14, 14],
  [65, 24, 21, 18, 16, 15, 15, 15, 15, 16],
  [60, 27, 23, 20, 18, 16, 16, 16, 18, 18],
  [55, 30, 25, 22, 20, 18, 18, 18, 20, 20],
  [50, 34, 29, 25, 22, 20, 20, 20, 22, 24],
  [45, 40, 34, 29, 26, 24, 24, 24, 26, 28],
  [40, 48, 42, 36, 32, 28, 28, 28, 30, 36],
  [35, 60, 52, 46, 40, 36, 36, 36, 42, 48],
  [30, 76, 68, 60, 54, 50, 50, 50, 56, 60],
  // Below Lc 30, text is not recommended; only non-text/decorative use is allowed.
  [25, NEVER, NEVER, NEVER, NEVER, NEVER, NEVER, NEVER, NEVER, NEVER]
] as const;

/** Snap an arbitrary weight to the nearest of the nine table columns. */
const nearestWeight = (weight: number): FontWeight =>
  FONT_WEIGHTS.reduce((best, w) =>
    Math.abs(w - weight) < Math.abs(best - weight) ? w : best
  );

/**
 * The minimum legible font size (px) for a given absolute Lc and weight, per the
 * APCA lookup. Returns {@link NEVER} if no size is acceptable at that contrast, or
 * `Infinity` if the contrast is below the table's floor (Lc < 25 → unusable for text).
 */
export const minFontSize = (lc: number, weight: number): number => {
  const absLc = Math.abs(lc);
  const col = FONT_WEIGHTS.indexOf(nearestWeight(weight)) + 1;
  for (const row of TABLE) {
    if (absLc >= row[0]) return row[col];
  }
  return Infinity;
};

/** Whether `lc` is sufficient for body text at `sizePx`/`weight` (the common ask). */
export const passesAPCA = (
  lc: number,
  sizePx: number,
  weight: number
): boolean => {
  const min = minFontSize(lc, weight);
  return min !== NEVER && sizePx >= min;
};

/** A coarse readability tier for an Lc value (for at-a-glance labeling, SPEC §2.5). */
export type ContrastTier =
  | "fluent" // Lc ≥ 90 — body text at any size
  | "body" // Lc ≥ 75 — minimum for columns of body text
  | "content" // Lc ≥ 60 — non-body content text
  | "large" // Lc ≥ 45 — large/headline text
  | "nonText" // Lc ≥ 30 — UI elements, borders
  | "minimum" // Lc ≥ 15 — incidental / disabled
  | "insufficient"; // below Lc 15

/** Map an Lc value to its {@link ContrastTier} (uses absolute Lc). */
export const contrastTier = (lc: number): ContrastTier => {
  const absLc = Math.abs(lc);
  if (absLc >= 90) return "fluent";
  if (absLc >= 75) return "body";
  if (absLc >= 60) return "content";
  if (absLc >= 45) return "large";
  if (absLc >= 30) return "nonText";
  if (absLc >= 15) return "minimum";
  return "insufficient";
};
