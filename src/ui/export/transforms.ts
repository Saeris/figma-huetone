/**
 * Export transforms (Phase 7, SPEC §2.13) — the last hop of the lifecycle: the
 * canonical DTCG {@link TokenTree} out to consumable artifacts. Because the internal
 * model already IS DTCG, these are pure transforms with no new color authority.
 *
 * Two targets in v1:
 *  - **DTCG JSON** — effectively a passthrough of the tree (a tidy `JSON.stringify`).
 *  - **CSS custom properties** in the `@saeris/colors` shape — `--{group}-{scale}`
 *    set to the token's **okLCH source** (`oklch(L C H)`), not the gamut-clipped
 *    `$value`. CSS `oklch()` is wide-gamut and the browser maps it per display, so
 *    exporting the lossless source is strictly better than exporting clipped hex —
 *    the payoff of preserving okLCH end to end.
 *
 * Alpha variants and the P3 `@supports` block (which only the alpha values need) ship
 * with the deferred alpha phase; v1 exports opaque values only.
 */

import { type Oklch, formatOklch } from "../color/index.js";
import {
  type ColorToken,
  EXTENSION_KEY,
  isColorToken,
  type TokenGroup,
  type TokenTree
} from "../tokens/index.js";

/** The export formats offered (SPEC §2.13). */
export type ExportFormat = "dtcg" | "css";

/** Serialize the canonical tree as DTCG JSON (a passthrough — the tree is DTCG). */
export const toDtcgJson = (tree: TokenTree): string =>
  JSON.stringify(tree, null, 2);

/** Read a token's canonical okLCH (its `$extensions` source, or derive from value). */
const tokenOklch = (token: ColorToken): Oklch => {
  const source = token.$extensions?.[EXTENSION_KEY]?.oklch;
  if (source) {
    const [l, c, h] = source;
    return { l, c, h, alpha: token.$value.alpha ?? 1 };
  }
  // Fallback: a foreign token with no okLCH source — use the DTCG components as-is.
  const [l, c, h] = token.$value.components;
  return { l, c, h, alpha: token.$value.alpha ?? 1 };
};

/** Walk the tree depth-first, yielding `[pathSegments, token]` for each color token. */
const walkTokens = (
  node: TokenGroup,
  prefix: string[] = []
): Array<[string[], ColorToken]> =>
  Object.entries(node).flatMap(([key, child]) => {
    if (key.startsWith("$") || child === undefined) return [];
    if (isColorToken(child)) return [[[...prefix, key], child]];
    if (typeof child === "object") return walkTokens(child, [...prefix, key]);
    return [];
  });

/**
 * Emit the palette as CSS custom properties in the `@saeris/colors` shape:
 * `:root { --{group}-{scale}: oklch(L C H); … }`, ready to drop into a Tailwind +
 * Shadcn project. Variable names join path segments with `-`.
 */
export const toCss = (tree: TokenTree): string => {
  const decls = walkTokens(tree)
    .map(
      ([path, token]) =>
        `  --${path.join("-")}: ${formatOklch(tokenOklch(token))};`
    )
    .sort((a, b) => a.localeCompare(b));
  return `:root {\n${decls.join("\n")}\n}\n`;
};

/** Serialize the tree to the chosen `format`. */
export const exportTokens = (tree: TokenTree, format: ExportFormat): string =>
  format === "dtcg" ? toDtcgJson(tree) : toCss(tree);
