/**
 * Bridge between the color engine ({@link Oklch}) and DTCG color tokens
 * ({@link ColorToken}). This is where SPEC §2.7's persistence model becomes
 * concrete: a token's `$value` is the **derived, gamut-mapped** RGB the renderer
 * uses, while the **canonical okLCH source** rides along in `$extensions`.
 *
 * `colorTokenFromOklch` is the write path (okLCH → token); `oklchFromColorToken`
 * is the read path, and it embodies the round-trip guarantee: prefer the lossless
 * `$extensions` okLCH, fall back to re-deriving from `$value` only when the source
 * is missing (e.g. a token authored by another tool).
 */

import {
  type Gamut,
  type Oklch,
  type Rgb,
  rgbToOklch,
  toRgb
} from "../color/index.js";
import {
  type ColorToken,
  type DtcgColorValue,
  EXTENSION_KEY
} from "./schema.js";

/** Map our internal gamut id to the DTCG `colorSpace` string. */
const DTCG_SPACE: Record<Gamut, DtcgColorValue["colorSpace"]> = {
  srgb: "srgb",
  p3: "display-p3"
};

const GAMUT_FROM_DTCG: Record<DtcgColorValue["colorSpace"], Gamut> = {
  srgb: "srgb",
  "display-p3": "p3"
};

const toHex = ({ r, g, b, a }: Rgb): string => {
  const channel = (n: number): string =>
    Math.round(Math.min(1, Math.max(0, n)) * 255)
      .toString(16)
      .padStart(2, "0");
  const base = `#${channel(r)}${channel(g)}${channel(b)}`;
  return a < 1 ? `${base}${channel(a)}` : base;
};

/**
 * Build a DTCG color token from a canonical okLCH color, gamut-mapping `$value`
 * into `gamut` (which should follow the document's color profile — SPEC §2.7).
 * The okLCH source is stored verbatim in `$extensions`, so the token round-trips
 * losslessly regardless of how `$value` was clipped.
 */
export const colorTokenFromOklch = (color: Oklch, gamut: Gamut): ColorToken => {
  const rgb = toRgb(color, gamut);
  return {
    $type: "color",
    $value: {
      colorSpace: DTCG_SPACE[gamut],
      components: [rgb.r, rgb.g, rgb.b],
      ...(rgb.a < 1 ? { alpha: rgb.a } : {}),
      hex: toHex(rgb)
    },
    $extensions: {
      [EXTENSION_KEY]: { oklch: [color.l, color.c, color.h] }
    }
  };
};

/**
 * Read the canonical okLCH out of a color token. Uses the lossless `$extensions`
 * source when present; otherwise re-derives okLCH from `$value` (lossy, but the
 * best available for foreign tokens). Alpha is taken from `$value` either way,
 * since `$extensions` stores only the L/C/H triple.
 */
export const oklchFromColorToken = (token: ColorToken): Oklch => {
  const alpha = token.$value.alpha ?? 1;
  const source = token.$extensions?.[EXTENSION_KEY]?.oklch;
  if (source) {
    const [l, c, h] = source;
    return { l, c, h, alpha };
  }
  const [r, g, b] = token.$value.components;
  const recovered = rgbToOklch(
    { r, g, b, a: alpha },
    GAMUT_FROM_DTCG[token.$value.colorSpace]
  );
  return recovered;
};
