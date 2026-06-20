/**
 * The IPC contract — the single source of truth for everything that crosses the sandbox↔UI boundary. Both threads import these types, so a change here is a compile error on whichever side falls out of sync. This is the piece that makes the bridge tRPC-like: the transport is untyped `postMessage`, but every `call` and `on` is typed against this contract.
 *
 * Two kinds of message:
 *
 * - **Procedures** ({@link Procedures}) — request→reply RPC. The UI `call`s a procedure; the main thread handles it and returns a value (the reply travels back over a correlation id, see `transport.ts`). Model the plugin's document reads and writes here.
 * - **Events** ({@link Events}) — fire-and-forget push from main→UI. The main thread `emit`s; the UI `on`s. Model live document state here.
 *
 * Grow the API by editing this file (and the two thread entries) only — the bridge, transport, and signals are all generic over these maps.
 */

import type { TokenTree } from "./tokens.js";

/**
 * Figma's document color profile (`figma.root.documentColorProfile`). Drives the gamut we map okLCH into: `"DISPLAY_P3"` → P3, otherwise sRGB (SPEC §2.7).
 */
export type ColorProfile = "LEGACY" | "SRGB" | "DISPLAY_P3";

/**
 * A single token edit, addressed by its path in the {@link TokenTree} and the mode it applies to. The UI does the okLCH→RGBA gamut mapping (it owns the color math) and sends BOTH the derived render value and the canonical okLCH source string, so the sandbox handler just writes them to the Variable — `rgba` to the mode value, `oklch` to the code syntax (the lossless source — SPEC §2.7).
 */
export interface TokenEdit {
  /** Dot-free path segments from the tree root, e.g. `["red", "500"]`. */
  path: string[];
  /**
   * The collection mode this value applies to (e.g. light/dark). Omit to target the collection's default mode — used in Phase 1 before mode selection exists.
   */
  modeId?: string;
  /** Derived, gamut-mapped render value; channels + alpha in [0, 1]. */
  rgba: { r: number; g: number; b: number; a: number };
  /** Canonical `oklch(L C H)` string to persist as the source of truth. */
  oklch: string;
}

/** A solid color extracted from a Figma node fill; channels + alpha in [0, 1]. */
export interface SelectionColor {
  /** A human label for the node the color came from (its name). */
  label: string;
  rgba: { r: number; g: number; b: number; a: number };
}

/**
 * The foreground/background pair derived from the current canvas selection
 * (Polychrom-style, SPEC §2.3). The sandbox extracts the solid fills (it has no
 * color math); the UI converts to okLCH and computes APCA/WCAG. `null` when the
 * selection doesn't yield a usable pair (no solid fill, too many nodes, etc.).
 */
export interface SelectionContrast {
  foreground: SelectionColor;
  background: SelectionColor;
}

/**
 * Request→reply procedures the UI can `call` and the main thread handles. Each entry is `(input) => output`; either may be `void`. Inputs and outputs must be structured-clonable (no functions, DOM nodes, or class instances) — everything crossing `postMessage` is cloned. A `TokenTree` is plain JSON, so it crosses as-is.
 */
export interface Procedures {
  /**
   * Find the plugin's managed Base Tokens collection (by a private plugin-data marker, robust to renames), creating it if absent. Returns its id.
   */
  ensurePaletteCollection: (input: { name: string }) => {
    collectionId: string;
  };
  /** Read the document's color profile, to pick the gamut-mapping target. */
  getColorProfile: () => { profile: ColorProfile };
  /** Read the managed collection's color variables into a canonical DTCG tree. */
  readTokens: () => { tree: TokenTree };
  /**
   * Apply one token edit (write the mode RGBA + okLCH code syntax). Creates the variable if the path is new. Returns the re-read tree so the UI stays in sync.
   */
  editToken: (input: TokenEdit) => { tree: TokenTree };
  /**
   * Rename a color group (`from` → `to`): renames every variable `from/*` to `to/*`.
   * A no-op if `from` doesn't exist. Returns the refreshed tree.
   */
  renameGroup: (input: { from: string; to: string }) => { tree: TokenTree };
  /**
   * Rename a scale step across all groups (`from` → `to`): renames every variable
   * whose last path segment is `from`. Returns the refreshed tree.
   */
  renameScale: (input: { from: string; to: string }) => { tree: TokenTree };
  /**
   * Remove a color group: deletes every variable under the `name` group. Returns the
   * refreshed tree.
   */
  removeGroup: (input: { name: string }) => { tree: TokenTree };
  /**
   * Remove a scale step across all groups: deletes every variable whose last path
   * segment is `scale`. Returns the refreshed tree.
   */
  removeScale: (input: { scale: string }) => { tree: TokenTree };
  /** Read the foreground/background contrast pair from the current selection, or null. */
  getSelectionContrast: () => { contrast: SelectionContrast | null };
  /** Close the plugin (optionally surfacing a toast first). */
  close: (input?: { notify?: string }) => void;
}

/**
 * Push events the main thread `emit`s and the UI `on`s. Each entry is the payload type for that event (use `void` for payload-less events).
 */
export interface Events {
  /** Fired when the managed collection changes, carrying the fresh DTCG tree. */
  tokensChanged: { tree: TokenTree };
  /** Fired when the canvas selection changes, with the derived contrast pair (or null). */
  selectionContrastChanged: { contrast: SelectionContrast | null };
}

// --- derived helper types (you should not need to touch these) ---

/** Names of all procedures. */
export type ProcedureName = keyof Procedures;
/** Names of all events. */
export type EventName = keyof Events;

/** The input type of procedure `K` (its single argument, or `undefined`). */
export type ProcedureInput<K extends ProcedureName> = Procedures[K] extends (
  input: infer I
) => unknown
  ? I
  : undefined;

/** The resolved output type of procedure `K`. */
export type ProcedureOutput<K extends ProcedureName> = Awaited<
  ReturnType<Procedures[K]>
>;

/** A handler for procedure `K`, as registered on the main thread. May be async. */
export type ProcedureHandler<K extends ProcedureName> = (
  input: ProcedureInput<K>
) => ProcedureOutput<K> | Promise<ProcedureOutput<K>>;

/** A listener for event `K`, as registered on the UI thread. */
export type EventHandler<K extends EventName> = (payload: Events[K]) => void;
