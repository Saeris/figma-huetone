/**
 * The canonical DTCG token model (SPEC §2.14): schema (Valibot source of truth + inferred types) and the okLCH ⇄ color-token bridge that carries the lossless source in `$extensions`.
 */

export {
  EXTENSION_KEY,
  type ColorToken,
  type DtcgColorValue,
  type TokenGroup,
  type TokenTree,
  ColorTokenSchema,
  DtcgColorValueSchema,
  isColorToken,
  OklchExtensionSchema,
  TokenTreeSchema
} from "./schema.js";
export { colorTokenFromOklch, oklchFromColorToken } from "./color-token.js";
