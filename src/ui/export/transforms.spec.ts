/**
 * Tests for the export transforms (Phase 7). These assert the end-to-end payoff: the
 * exported CSS carries the LOSSLESS okLCH source (not the gamut-clipped value), names
 * variables in the `@saeris/colors` shape, and the DTCG export round-trips the tree.
 * Pure — no DOM.
 */

import { describe, expect, it } from "vitest";
import { colorTokenFromOklch } from "../tokens/index.js";
import type { TokenGroup } from "../tokens/index.js";
import type { Oklch } from "../color/index.js";
import { exportTokens, toCss, toDtcgJson } from "./transforms.js";

const token = (color: Oklch): TokenGroup =>
  colorTokenFromOklch(color, "srgb") as unknown as TokenGroup;

const tree: TokenGroup = {
  $type: "color",
  red: {
    "500": token({ l: 0.627, c: 0.21, h: 25.4 }),
    "100": token({ l: 0.9, c: 0.05, h: 25.4 })
  },
  blue: {
    "500": token({ l: 0.55, c: 0.18, h: 255 })
  }
};

describe("toCss", () => {
  it("names variables --{group}-{scale} in the @saeris/colors shape", () => {
    const css = toCss(tree);
    expect(css).toContain("--red-500:");
    expect(css).toContain("--red-100:");
    expect(css).toContain("--blue-500:");
    expect(css.startsWith(":root {")).toBe(true);
  });

  it("emits the lossless okLCH source, not a clipped value", () => {
    // The vivid value stays as authored okLCH in the export.
    const vivid: TokenGroup = {
      $type: "color",
      green: { "500": token({ l: 0.86, c: 0.29, h: 142 }) }
    };
    expect(toCss(vivid)).toContain("--green-500: oklch(0.86 0.29 142)");
  });

  it("sorts declarations for stable output", () => {
    const css = toCss(tree);
    const lines = css
      .split("\n")
      .filter((l) => l.includes("--"))
      .map((l) => l.trim());
    expect(lines).toEqual([...lines].sort((a, b) => a.localeCompare(b)));
  });
});

describe("toDtcgJson", () => {
  it("round-trips the canonical DTCG tree", () => {
    const json = toDtcgJson(tree);
    expect(JSON.parse(json)).toEqual(tree);
  });
});

describe("exportTokens", () => {
  it("dispatches to the chosen format", () => {
    expect(exportTokens(tree, "css")).toBe(toCss(tree));
    expect(exportTokens(tree, "dtcg")).toBe(toDtcgJson(tree));
  });
});
