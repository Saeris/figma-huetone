/**
 * The DTCG token types that cross the IPC bridge — the plugin's canonical model (SPEC §2.14), as the wire contract sees it.
 *
 * These live in `src/ipc` (not `src/ui`) on purpose: both threads need them. The sandbox maps Figma Variables ↔ a `TokenTree`; the UI edits it. Keeping them here as **pure types** (no Valibot, no colorjs) preserves `src/ipc` as a dependency leaf both `src/main` and `src/ui` can include, and guarantees the payloads are plain structured-clonable JSON (DTCG *is* JSON, so the tree crosses as-is).
 *
 * The runtime Valibot schema that validates these (and the okLCH ⇄ token bridge) lives in `src/ui/tokens`, which imports these types.
 *
 * Reference: https://www.designtokens.org/tr/drafts/format/
 */

/**
 * Our reverse-domain `$extensions` key (DTCG requires tools to preserve extension data they don't understand). The canonical okLCH source lives under it, since okLCH is not yet a first-class DTCG `colorSpace`.
 *
 * Defined once so a future rename (the product can't ship as "Huetone" — SPEC §6) is a single-line change.
 */
export const EXTENSION_KEY = "io.saeris.huetone";

/** DTCG color spaces we emit in `$value`. okLCH lives in `$extensions`, not here. */
export type DtcgColorSpace = "srgb" | "display-p3";

/**
 * A DTCG `color` token's `$value`: a color-space tag plus continuous channel `components` (the precision fix vs. hex), optional `alpha`, and an optional `hex` fallback for tools that only read hex.
 */
export interface DtcgColorValue {
  colorSpace: DtcgColorSpace;
  components: [number, number, number];
  alpha?: number;
  hex?: string;
}

/** Canonical okLCH source carried in `$extensions[EXTENSION_KEY]`: `[L, C, H]`. */
export interface OklchExtension {
  oklch: [number, number, number];
}

/** A DTCG color token: an object WITH a `$value`. */
export interface ColorToken {
  $value: DtcgColorValue;
  $type?: "color";
  $description?: string;
  $extensions?: {
    [EXTENSION_KEY]?: OklchExtension;
  };
}

/**
 * A token group: an object WITHOUT a `$value`, holding child tokens and/or nested groups, optionally typed/described at the group level. Recursive, per DTCG.
 */
export interface TokenGroup {
  $type?: "color";
  $description?: string;
  // Child tokens / nested groups, plus the optional `$`-prefixed group props above
  // (whose `string` values are subsumed here).
  [name: string]: TokenGroup | ColorToken | string | undefined;
}

/** The root of the canonical model: a (possibly nested) group of color tokens. */
export type TokenTree = TokenGroup;

/** Type guard: a DTCG node is a token (vs. a group) iff it has a `$value`. */
export const isColorToken = (node: unknown): node is ColorToken =>
  typeof node === "object" && node !== null && "$value" in node;
