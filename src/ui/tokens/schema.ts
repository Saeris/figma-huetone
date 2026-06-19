/**
 * Valibot runtime validation for the canonical DTCG model (SPEC §2.14). The token **types** live in `src/ipc/tokens.ts` (shared, pure-type leaf both threads import); this module adds the runtime schemas that validate untrusted input — e.g. a `TokenTree` read back from a document or another tool — and re-exports the types for convenience.
 *
 * We model only the slice of DTCG the plugin needs today (`color` tokens, groups, aliases), spec-compatibly, so we can grow into more of DTCG later.
 */

import * as v from "valibot";
import {
  type ColorToken,
  EXTENSION_KEY,
  isColorToken,
  type TokenGroup
} from "../../ipc/tokens.js";

export {
  type ColorToken,
  type DtcgColorSpace,
  type DtcgColorValue,
  EXTENSION_KEY,
  isColorToken,
  type OklchExtension,
  type TokenGroup,
  type TokenTree
} from "../../ipc/tokens.js";

/** DTCG color spaces we emit in `$value`. okLCH lives in `$extensions`, not here. */
export const ColorSpaceSchema = v.picklist(["srgb", "display-p3"]);

/** Runtime schema for a DTCG `color` token's `$value`. */
export const DtcgColorValueSchema = v.object({
  colorSpace: ColorSpaceSchema,
  components: v.pipe(v.array(v.number()), v.length(3)),
  alpha: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1))),
  hex: v.optional(v.pipe(v.string(), v.regex(/^#[0-9a-fA-F]{6,8}$/u)))
});

/** Canonical okLCH source carried in `$extensions[EXTENSION_KEY]`. */
export const OklchExtensionSchema = v.object({
  oklch: v.pipe(v.array(v.number()), v.length(3))
});

const ExtensionsSchema = v.object({
  [EXTENSION_KEY]: v.optional(OklchExtensionSchema)
});

/**
 * Runtime schema for a color token. `$type` is optional on individual tokens (it
 * can be inherited from a group) but must be `"color"` when present.
 */
export const ColorTokenSchema = v.object({
  $value: DtcgColorValueSchema,
  $type: v.optional(v.literal("color")),
  $description: v.optional(v.string()),
  $extensions: v.optional(ExtensionsSchema)
});

/**
 * Runtime schema for a node that is either a color token or a group of them. Tokens are distinguished from groups by the presence of `$value` (per DTCG); groups are recursive, so we validate them lazily.
 *
 * The recursive group branch (`objectWithRest`) has an inferred output type that doesn't structurally match our hand-written {@link TokenGroup} interface (its index signature is wider), so we annotate the schema with our intended type via a single `GenericSchema` parameter — the one reviewed seam between Valibot's inference and our DTCG types, mirroring how the IPC bridge re-applies contract types over the untyped transport.
 */
// The explicit annotation breaks the recursive inference cycle (the schema references itself via `v.lazy`). Valibot's recursive `objectWithRest` output doesn't structurally match our hand-written DTCG types, so the lazy schema is asserted to our intended type — the one reviewed seam between Valibot's inference and our DTCG types (mirrors the IPC bridge re-applying contract types over the untyped transport).
export const TokenNodeSchema: v.GenericSchema<
  unknown,
  ColorToken | TokenGroup
> =
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- inference seam (see comment above)
  v.lazy((input) =>
    isColorToken(input)
      ? ColorTokenSchema
      : v.objectWithRest(
          {
            $type: v.optional(v.literal("color")),
            $description: v.optional(v.string())
          },
          v.lazy(() => TokenNodeSchema)
        )
  ) as unknown as v.GenericSchema<unknown, ColorToken | TokenGroup>;

/** Validate (and narrow) an unknown value as a {@link TokenTree}. */
export const TokenTreeSchema = TokenNodeSchema;
