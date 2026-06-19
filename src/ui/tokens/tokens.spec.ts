/**
 * Tests for the canonical DTCG model. These encode WHY the model is shaped as it is (SPEC §2.14):
 *
 * - a color token carries the lossless okLCH source in `$extensions`, so okLCH → token → okLCH round-trips EXACTLY — the precision guarantee the whole plugin depends on, now at the token layer;
 * - `$value` is the DTCG color the renderer/other tools read, gamut-mapped to the active profile and tagged with the matching `colorSpace`;
 * - a foreign token with no `$extensions` source still yields okLCH (re-derived from `$value`), so we interoperate with tokens authored elsewhere;
 * - the schema validates real tokens and rejects malformed ones, and distinguishes tokens (have `$value`) from groups (don't) per DTCG.
 */

import { describe, expect, it } from "vitest";
import * as v from "valibot";
import type { Oklch } from "../color/index.js";
import {
  type ColorToken,
  colorTokenFromOklch,
  ColorTokenSchema,
  EXTENSION_KEY,
  oklchFromColorToken,
  TokenTreeSchema
} from "./index.js";

describe("color token round-trip", () => {
  it("preserves okLCH exactly via the $extensions source", () => {
    const color: Oklch = { l: 0.627, c: 0.21, h: 25.4, alpha: 1 };
    const token = colorTokenFromOklch(color, "srgb");

    // The lossless source is stored verbatim, independent of how $value clipped.
    expect(token.$extensions?.[EXTENSION_KEY]?.oklch).toEqual([
      0.627, 0.21, 25.4
    ]);

    const back = oklchFromColorToken(token);
    expect(back.l).toBe(0.627);
    expect(back.c).toBe(0.21);
    expect(back.h).toBe(25.4);
  });

  it("tags $value with the gamut it was mapped into", () => {
    const color: Oklch = { l: 0.6, c: 0.05, h: 200 };
    expect(colorTokenFromOklch(color, "srgb").$value.colorSpace).toBe("srgb");
    expect(colorTokenFromOklch(color, "p3").$value.colorSpace).toBe(
      "display-p3"
    );
  });

  it("keeps the lossless source even when $value is gamut-clipped", () => {
    // Vivid green: out of sRGB, so $value is chroma-reduced — but the okLCH source
    // must still reflect the ORIGINAL intent (SPEC §2.7).
    const vivid: Oklch = { l: 0.86, c: 0.29, h: 142 };
    const token = colorTokenFromOklch(vivid, "srgb");

    expect(token.$extensions?.[EXTENSION_KEY]?.oklch).toEqual([
      0.86, 0.29, 142
    ]);
    expect(oklchFromColorToken(token).c).toBe(0.29); // intent, not the clipped value
  });

  it("carries alpha into $value and back", () => {
    const color: Oklch = { l: 0.5, c: 0.1, h: 200, alpha: 0.4 };
    const token = colorTokenFromOklch(color, "srgb");
    expect(token.$value.alpha).toBeCloseTo(0.4, 5);
    expect(oklchFromColorToken(token).alpha).toBeCloseTo(0.4, 5);
  });

  it("emits a hex fallback for tools that only read hex", () => {
    const token = colorTokenFromOklch({ l: 0, c: 0, h: 0 }, "srgb");
    expect(token.$value.hex).toBe("#000000");
  });
});

describe("foreign token interop", () => {
  it("re-derives okLCH from $value when no $extensions source is present", () => {
    // A token another tool authored — DTCG color, no okLCH extension.
    const foreign: ColorToken = {
      $type: "color",
      $value: { colorSpace: "srgb", components: [0, 0, 0] }
    };
    const oklch = oklchFromColorToken(foreign);
    expect(oklch.l).toBeCloseTo(0, 5); // black
  });
});

describe("schema validation", () => {
  it("accepts a well-formed color token", () => {
    const token = colorTokenFromOklch({ l: 0.5, c: 0.1, h: 200 }, "srgb");
    expect(() => v.parse(ColorTokenSchema, token)).not.toThrow();
  });

  it("rejects a color value with the wrong number of components", () => {
    const bad = {
      $type: "color",
      $value: { colorSpace: "srgb", components: [0, 0] }
    };
    expect(() => v.parse(ColorTokenSchema, bad)).toThrow();
  });

  it("validates a nested group tree, distinguishing tokens from groups", () => {
    const tree = {
      $type: "color",
      red: {
        "500": colorTokenFromOklch({ l: 0.627, c: 0.21, h: 25 }, "srgb"),
        "600": colorTokenFromOklch({ l: 0.55, c: 0.2, h: 25 }, "srgb")
      }
    };
    expect(() => v.parse(TokenTreeSchema, tree)).not.toThrow();
  });
});
