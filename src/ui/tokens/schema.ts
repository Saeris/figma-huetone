/**
 * DTCG (Design Tokens Community Group) schema — the plugin's CANONICAL internal
 * model (SPEC §2.14). Figma Variables, editor state, and every export are
 * projections of this tree. We use Valibot as the single source of truth: the
 * schemas validate untrusted input (e.g. tokens read back from a document) and the
 * inferred types flow everywhere else.
 *
 * We model only the slice of DTCG the plugin needs today — `color` tokens, groups,
 * and aliases — not the full spec (composites, dimensions, etc.). The shape stays
 * spec-compatible so we can grow into more of DTCG, and so the tree round-trips
 * with Figma's emerging native DTCG export.
 *
 * Reference: https://www.designtokens.org/tr/drafts/format/
 */

import * as v from "valibot";

/**
 * Our reverse-domain `$extensions` key (DTCG requires tools to preserve extension
 * data they don't understand). The canonical okLCH source lives here, since okLCH
 * is not yet a first-class DTCG `colorSpace`.
 *
 * Defined once so a future rename (the product can't ship as "Huetone" — SPEC §6)
 * is a single-line change. Migrating tokens already carrying the old key is a
 * separate concern handled at read time.
 */
export const EXTENSION_KEY = "io.saeris.huetone" as const;

/** DTCG color spaces we emit in `$value`. okLCH lives in `$extensions`, not here. */
export const ColorSpaceSchema = v.picklist(["srgb", "display-p3"]);

/**
 * A DTCG `color` token's `$value`: a color-space tag plus continuous channel
 * `components` (the precision fix vs. hex), optional `alpha`, and an optional `hex`
 * fallback for tools that only read hex.
 */
export const DtcgColorValueSchema = v.object({
  colorSpace: ColorSpaceSchema,
  components: v.pipe(v.array(v.number()), v.length(3)),
  alpha: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1))),
  hex: v.optional(v.pipe(v.string(), v.regex(/^#[0-9a-fA-F]{6,8}$/u)))
});

/** Canonical okLCH source carried in `$extensions[EXTENSION_KEY]`. */
export const OklchExtensionSchema = v.object({
  /** `[L, C, H]` — L ∈ [0,1], C ≥ 0, H in degrees. The lossless source of truth. */
  oklch: v.pipe(v.array(v.number()), v.length(3))
});

const ExtensionsSchema = v.object({
  [EXTENSION_KEY]: v.optional(OklchExtensionSchema)
});

/**
 * A DTCG color token: an object WITH a `$value`. `$type` is optional on individual
 * tokens (it can be inherited from a group), but when present must be `"color"`.
 */
export const ColorTokenSchema = v.object({
  $value: DtcgColorValueSchema,
  $type: v.optional(v.literal("color")),
  $description: v.optional(v.string()),
  $extensions: v.optional(ExtensionsSchema)
});

export type DtcgColorValue = v.InferOutput<typeof DtcgColorValueSchema>;
export type ColorToken = v.InferOutput<typeof ColorTokenSchema>;

/**
 * A token group: an object WITHOUT a `$value`, holding child tokens and/or nested
 * groups, optionally typed/described at the group level.
 *
 * DTCG groups are recursive, which Valibot can't express as a single static schema
 * without a lazy self-reference. We declare the recursive `TokenTree` type
 * explicitly and validate it with a `v.lazy` schema so runtime validation matches.
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

const isTokenLike = (input: unknown): input is { $value: unknown } =>
  typeof input === "object" && input !== null && "$value" in input;

/**
 * Runtime schema for a node that is either a color token or a group of them.
 * Tokens are distinguished from groups by the presence of `$value` (per DTCG).
 */
export const TokenNodeSchema: v.GenericSchema<TokenGroup | ColorToken> = v.lazy(
  (input) =>
    isTokenLike(input)
      ? ColorTokenSchema
      : v.objectWithRest(
          {
            $type: v.optional(v.literal("color")),
            $description: v.optional(v.string())
          },
          // Reserved `$`-prefixed keys are handled above; every other key is a
          // child token or nested group.
          v.lazy(() => TokenNodeSchema)
        )
);

/** Validate (and narrow) an unknown value as a {@link TokenTree}. */
export const TokenTreeSchema = TokenNodeSchema;
