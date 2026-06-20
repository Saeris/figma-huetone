/**
 * Palette view-model (SPEC §2.12, Phase 2): pure functions that project a canonical
 * DTCG {@link TokenTree} into a renderable grid of groups × scales, and the inverse
 * helpers the editor needs. No React, no Figma — just data, so it's unit-testable in
 * isolation and the grid component stays a thin renderer.
 *
 * Phase 2 keeps the axes simple: groups are the tree's top-level color names, scales
 * are the token keys beneath them, both ordered (numeric-aware) for a stable layout.
 * User-configurable axis order/rename is Phase 3.
 */

import type { Oklch } from "../color/index.js";
import { isColorToken, oklchFromColorToken } from "../tokens/index.js";
import type { ColorToken, TokenGroup } from "../tokens/index.js";

/** One cell of the grid: a swatch at (group, scale) with its canonical okLCH. */
export interface SwatchVM {
  /** Path segments addressing the token, e.g. `["red", "500"]`. */
  path: string[];
  group: string;
  scale: string;
  /** Canonical okLCH (from the token's `$extensions`, or derived from `$value`). */
  oklch: Oklch;
}

/** A row of the grid: one color group across all scales (missing cells are gaps). */
export interface RampVM {
  group: string;
  /** One entry per column in {@link PaletteVM.scales}; `null` where the cell is empty. */
  swatches: Array<SwatchVM | null>;
}

/** The renderable palette: ordered scale columns and one ramp row per group. */
export interface PaletteVM {
  /** Ordered scale names — the grid columns (e.g. `["50","100",…,"950"]`). */
  scales: string[];
  /** One ramp per color group — the grid rows. */
  ramps: RampVM[];
}

/** A color group node (skips reserved `$`-prefixed group props). */
const childGroups = (tree: TokenGroup): Array<[string, TokenGroup]> =>
  Object.entries(tree).filter(
    (entry): entry is [string, TokenGroup] =>
      !entry[0].startsWith("$") &&
      typeof entry[1] === "object" &&
      !isColorToken(entry[1])
  );

/** The color tokens directly under a group, by scale key. */
const childTokens = (group: TokenGroup): Array<[string, ColorToken]> =>
  Object.entries(group).filter(
    (entry): entry is [string, ColorToken] =>
      !entry[0].startsWith("$") && isColorToken(entry[1])
  );

/**
 * Order keys numeric-aware: pure-numeric scale steps sort ascending by value
 * (`"50" < "100" < "950"`), and any non-numeric keys sort lexically after them. This
 * gives the familiar Tailwind/Radix column order without configuration.
 */
const orderKeys = (keys: Iterable<string>): string[] =>
  [...new Set(keys)].sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    const aNum = !Number.isNaN(na);
    const bNum = !Number.isNaN(nb);
    if (aNum && bNum) return na - nb;
    if (aNum) return -1;
    if (bNum) return 1;
    return a.localeCompare(b);
  });

/**
 * Project a {@link TokenTree} into a {@link PaletteVM}. Scale columns are the union
 * of every group's scale keys (ordered), so ramps align even when groups have
 * different steps; a group missing a step gets a `null` cell there.
 */
export const toPaletteVM = (tree: TokenGroup): PaletteVM => {
  const groups = childGroups(tree);

  const scales = orderKeys(
    groups.flatMap(([, group]) => childTokens(group).map(([scale]) => scale))
  );

  const ramps: RampVM[] = groups.map(([groupName, group]) => {
    const byScale = new Map(childTokens(group));
    return {
      group: groupName,
      swatches: scales.map((scale) => {
        const token = byScale.get(scale);
        return token
          ? {
              path: [groupName, scale],
              group: groupName,
              scale,
              oklch: oklchFromColorToken(token)
            }
          : null;
      })
    };
  });

  return { scales, ramps };
};

/** Every swatch in the palette, flattened in row-major order (group then scale). */
export const allSwatches = (palette: PaletteVM): SwatchVM[] =>
  palette.ramps.flatMap((ramp) =>
    ramp.swatches.filter((s): s is SwatchVM => s !== null)
  );

/**
 * The per-channel sibling values for `selected` — the okLCH channel values of every
 * OTHER swatch in the same ramp (group). Feeds the histogram's relationship ticks so
 * a swatch's spacing against the rest of its ramp is visible (SPEC §2.10).
 */
export const rampSiblings = (
  palette: PaletteVM,
  selected: SwatchVM
): { l: number[]; c: number[]; h: number[] } => {
  const ramp = palette.ramps.find((r) => r.group === selected.group);
  const others = (ramp?.swatches ?? []).filter(
    (s): s is SwatchVM => s !== null && s.scale !== selected.scale
  );
  return {
    l: others.map((s) => s.oklch.l),
    c: others.map((s) => s.oklch.c),
    h: others.map((s) => s.oklch.h)
  };
};
