/**
 * One-time registration of the colorjs.io color spaces this plugin uses.
 *
 * Unlike colorjs.io's `Color` class (which auto-registers every space on
 * import), the tree-shakeable procedural `colorjs.io/fn` API is "bring your own
 * spaces": its `to` / `inGamut` / `toGamut` functions look spaces up by id in a
 * global registry, so each space must be `register`ed before use. Importing only
 * the four spaces we need — and registering them here, once — is exactly what
 * keeps the UI bundle small (the point of `/fn`; see SPEC §2.9).
 *
 * Import this module for its side effect before calling any `/fn` color function;
 * the rest of `src/ui/color` does so via `convert.ts`.
 */

import { ColorSpace, OKLCH, OKLab, sRGB, P3 } from "colorjs.io/fn";

/** The color-space ids registered by this module, as used across the color API. */
export type SpaceId = "oklch" | "oklab" | "srgb" | "p3";

let registered = false;

/**
 * Register the plugin's color spaces with colorjs.io's global registry. Idempotent
 * — safe to call from multiple entry points; only the first call does work.
 *
 * OKLCH depends on OKLab (it's the cylindrical form), so both are registered even
 * though only OKLCH is named directly in our API.
 */
export const registerSpaces = (): void => {
  if (registered) return;
  // OKLab first: OKLCH converts through it.
  ColorSpace.register(OKLab);
  ColorSpace.register(OKLCH);
  ColorSpace.register(sRGB);
  ColorSpace.register(P3);
  registered = true;
};
