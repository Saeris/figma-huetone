/**
 * Tests for the palette view-model (Phase 2). These assert the grid projection the
 * UI renders is correct and stable: groups become ramp rows, scale keys become
 * ordered columns (numeric-aware), ramps align across differing scale sets with
 * `null` gaps, and each cell carries the canonical okLCH (lossless from
 * `$extensions`). Pure data — no DOM.
 */

import { describe, expect, it } from "vitest";
import { colorTokenFromOklch } from "../tokens/index.js";
import type { TokenGroup } from "../tokens/index.js";
import type { Oklch } from "../color/index.js";
import { toPaletteVM } from "./model.js";
import { seedPalette, SEED_SCALES } from "./seed.js";

const token = (color: Oklch): TokenGroup =>
  colorTokenFromOklch(color, "srgb") as unknown as TokenGroup;

describe("toPaletteVM", () => {
  it("turns top-level groups into ramps and token keys into ordered columns", () => {
    const tree: TokenGroup = {
      $type: "color",
      red: {
        "500": token({ l: 0.6, c: 0.2, h: 25 }),
        "50": token({ l: 0.97, c: 0.05, h: 25 })
      }
    };
    const vm = toPaletteVM(tree);

    // Numeric-aware order: "50" before "500", not lexical.
    expect(vm.scales).toEqual(["50", "500"]);
    expect(vm.ramps).toHaveLength(1);
    expect(vm.ramps[0].group).toBe("red");
    expect(vm.ramps[0].swatches.map((s) => s?.scale)).toEqual(["50", "500"]);
  });

  it("aligns ramps across groups with different scales, gapping missing cells", () => {
    const tree: TokenGroup = {
      $type: "color",
      red: { "100": token({ l: 0.9, c: 0.1, h: 25 }) },
      blue: { "900": token({ l: 0.3, c: 0.1, h: 255 }) }
    };
    const vm = toPaletteVM(tree);

    expect(vm.scales).toEqual(["100", "900"]);
    const red = vm.ramps.find((r) => r.group === "red");
    // red has "100" but not "900" → a null in the "900" column.
    expect(red?.swatches[0]?.scale).toBe("100");
    expect(red?.swatches[1]).toBeNull();
  });

  it("carries lossless okLCH from $extensions into each swatch", () => {
    const tree: TokenGroup = {
      $type: "color",
      red: { "500": token({ l: 0.627, c: 0.21, h: 25.4 }) }
    };
    const swatch = toPaletteVM(tree).ramps[0].swatches[0];
    expect(swatch?.oklch.l).toBe(0.627);
    expect(swatch?.oklch.c).toBe(0.21);
    expect(swatch?.oklch.h).toBe(25.4);
    expect(swatch?.path).toEqual(["red", "500"]);
  });

  it("ignores reserved $-prefixed group props", () => {
    const tree: TokenGroup = {
      $type: "color",
      $description: "ignore me",
      red: { "500": token({ l: 0.6, c: 0.2, h: 25 }) }
    };
    expect(toPaletteVM(tree).ramps.map((r) => r.group)).toEqual(["red"]);
  });
});

describe("seedPalette", () => {
  it("produces aligned in-order ramps for every seed hue", () => {
    const seed = seedPalette();
    // Build a tree from the seed and project it; columns should match SEED_SCALES.
    const tree: TokenGroup = { $type: "color" };
    for (const [group, ramp] of Object.entries(seed)) {
      const groupNode: TokenGroup = {};
      for (const [scale, oklch] of Object.entries(ramp)) {
        groupNode[scale] = colorTokenFromOklch(oklch, "srgb");
      }
      tree[group] = groupNode;
    }
    const vm = toPaletteVM(tree);

    expect(vm.scales).toEqual([...SEED_SCALES]);
    expect(vm.ramps).toHaveLength(Object.keys(seed).length);
    // Every cell is filled (no gaps in the seed).
    for (const ramp of vm.ramps) {
      expect(ramp.swatches.every((s) => s !== null)).toBe(true);
    }
  });

  it("keeps seed swatches within sRGB so they never start out-of-gamut", async () => {
    const { inGamut } = await import("../color/index.js");
    for (const ramp of Object.values(seedPalette())) {
      for (const oklch of Object.values(ramp)) {
        expect(inGamut(oklch, "srgb")).toBe(true);
      }
    }
  });
});
