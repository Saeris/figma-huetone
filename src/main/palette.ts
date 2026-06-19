/**
 * Sandbox-side mapping between Figma Variables and the canonical DTCG
 * {@link TokenTree} (SPEC §2.7/§2.14). This is the "dumb" half of the persistence
 * spine: it does NO color math (the UI owns that — it sends ready-to-write `rgba`
 * + `oklch` in a {@link TokenEdit}); here we only read/write Figma's Variables API
 * and shuttle plain DTCG JSON across the bridge.
 *
 * Runs in `src/main` (needs the `figma` global, async `dynamic-page` API).
 *
 * **Phase 1 scope / known limitation.** Figma **code syntax is per-variable, not
 * per-mode**, but okLCH differs per mode (light/dark). So the lossless okLCH source
 * round-trips for ONE mode (the collection's default) today. Reading any other mode
 * derives okLCH from that mode's RGBA (lossy) until we move multi-mode okLCH storage
 * into plugin data — revisited when modes land (Phase 2).
 */

import {
  type ColorToken,
  type DtcgColorValue,
  EXTENSION_KEY,
  type TokenGroup,
  type TokenTree
} from "../ipc/tokens.js";
import type { TokenEdit } from "../ipc/contract.js";

/** Private plugin-data marker stamped on the collection we manage (SPEC §6.5). */
const MANAGED_MARKER_KEY = "huetone.managed";
/** Variable name path segments are joined with Figma's group separator. */
const NAME_SEP = "/";

/**
 * Find our managed Base Tokens collection by its private plugin-data marker —
 * robust to the user renaming it — creating it (marked, with `name`) if absent.
 */
export const ensurePaletteCollection = async (
  name: string
): Promise<VariableCollection> => {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const existing = collections.find(
    (c) => c.getPluginData(MANAGED_MARKER_KEY) === "1"
  );
  if (existing) return existing;

  const created = figma.variables.createVariableCollection(name);
  created.setPluginData(MANAGED_MARKER_KEY, "1");
  return created;
};

const isRgba = (value: VariableValue | undefined): value is RGBA =>
  typeof value === "object" &&
  "r" in value &&
  "g" in value &&
  "b" in value &&
  "a" in value;

const toHexChannel = (n: number): string =>
  Math.round(Math.min(1, Math.max(0, n)) * 255)
    .toString(16)
    .padStart(2, "0");

const rgbaToHex = ({ r, g, b, a }: RGBA): string => {
  const base = `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}`;
  return a < 1 ? `${base}${toHexChannel(a)}` : base;
};

/**
 * Parse the `L C H` triple out of an `oklch(L C H[ / a])` string (the form the UI
 * sends and we persist in code syntax). Returns `null` for anything unparseable —
 * the caller then falls back to deriving okLCH from the RGBA value.
 *
 * Deliberately a narrow numeric parse, not a full CSS color parser: the sandbox has
 * no colorjs, and we only ever read back strings we wrote.
 */
const parseOklchTriple = (
  css: string | undefined
): [number, number, number] | null => {
  if (!css) return null;
  const match = /^oklch\(\s*([^)]+)\)$/iu.exec(css.trim());
  if (!match) return null;
  const body = match[1].split("/")[0].trim();
  const parts = body.split(/\s+/u).map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  return [parts[0], parts[1], parts[2]];
};

const colorValueForMode = (
  variable: Variable,
  modeId: string
): DtcgColorValue | null => {
  const raw = variable.valuesByMode[modeId];
  if (!isRgba(raw)) return null; // alias / non-color / unset — skip in Phase 1
  return {
    // Figma stores variable RGBA as sRGB floats regardless of document profile.
    colorSpace: "srgb",
    components: [raw.r, raw.g, raw.b],
    ...(raw.a < 1 ? { alpha: raw.a } : {}),
    hex: rgbaToHex(raw)
  };
};

const colorTokenFor = (
  variable: Variable,
  modeId: string
): ColorToken | null => {
  const value = colorValueForMode(variable, modeId);
  if (!value) return null;
  const token: ColorToken = { $type: "color", $value: value };
  const oklch = parseOklchTriple(variable.codeSyntax.WEB);
  if (oklch) {
    token.$extensions = { [EXTENSION_KEY]: { oklch } };
  }
  return token;
};

/** Insert `token` into `tree` at the nested `path`, creating groups as needed. */
const setAtPath = (
  tree: TokenGroup,
  path: string[],
  token: ColorToken
): void => {
  let group = tree;
  for (const segment of path.slice(0, -1)) {
    const next = group[segment];
    if (typeof next === "object" && !("$value" in next)) {
      group = next;
    } else {
      const created: TokenGroup = {};
      group[segment] = created;
      group = created;
    }
  }
  group[path[path.length - 1]] = token;
};

/**
 * Project a managed collection's color variables into a canonical DTCG tree for
 * `modeId` (defaults to the collection's default mode). Variable names like
 * `red/500` become nested groups (`{ red: { "500": <token> } }`).
 */
export const readTokens = async (
  collection: VariableCollection,
  modeId: string = collection.defaultModeId
): Promise<TokenTree> => {
  const tree: TokenGroup = { $type: "color" };
  for (const id of collection.variableIds) {
    const variable = await figma.variables.getVariableByIdAsync(id);
    if (variable?.resolvedType !== "COLOR") continue;
    const token = colorTokenFor(variable, modeId);
    if (token) setAtPath(tree, variable.name.split(NAME_SEP), token);
  }
  return tree;
};

const findVariableByName = async (
  collection: VariableCollection,
  name: string
): Promise<Variable | null> => {
  for (const id of collection.variableIds) {
    const variable = await figma.variables.getVariableByIdAsync(id);
    if (variable?.name === name) return variable;
  }
  return null;
};

/**
 * Apply one {@link TokenEdit}: write the mode RGBA value and the okLCH code syntax,
 * creating the variable if its path is new. The UI already gamut-mapped the RGBA
 * and serialized the okLCH source, so this is a pure write.
 */
export const applyEdit = async (
  collection: VariableCollection,
  edit: TokenEdit
): Promise<void> => {
  const name = edit.path.join(NAME_SEP);
  const variable =
    (await findVariableByName(collection, name)) ??
    figma.variables.createVariable(name, collection, "COLOR");
  const modeId = edit.modeId ?? collection.defaultModeId;
  variable.setValueForMode(modeId, edit.rgba);
  variable.setVariableCodeSyntax("WEB", edit.oklch);
};
