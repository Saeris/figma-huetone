/**
 * The plugin UI (Phase 2): the ramp grid + numeric okLCH editor over the managed
 * Base Tokens collection. On open it reads the document color profile and the token
 * tree, seeds a default palette if the collection is empty, and renders the grid.
 * Selecting a swatch opens the editor; edits derive the gamut-mapped RGBA + okLCH
 * source and persist live via `editToken`, refreshing the grid from the returned
 * tree. The channel charts and contrast views arrive in later phases.
 */

import { type JSX, useCallback, useEffect, useMemo, useState } from "react";
import type { ColorProfile } from "../ipc/contract.js";
import type { TokenTree } from "../ipc/tokens.js";
import { createUiBridge } from "../ipc/channel.ui.js";
import { formatOklch, type Gamut, type Oklch, toRgb } from "./color/index.js";
import {
  RampGrid,
  rampSiblings,
  seedPalette,
  type SwatchVM,
  SwatchEditor,
  toPaletteVM
} from "./palette/index.js";
import "./App.css";

const bridge = createUiBridge();
const COLLECTION_NAME = "Huetone Base";

/** The gamut we map okLCH into, per the document profile (SPEC §2.7). */
const gamutFor = (profile: ColorProfile): Gamut =>
  profile === "DISPLAY_P3" ? "p3" : "srgb";

/** Persist one okLCH swatch edit; returns the refreshed tree. */
const writeToken = async (
  path: string[],
  color: Oklch,
  gamut: Gamut
): Promise<TokenTree> => {
  const { tree } = await bridge.call("editToken", {
    path,
    rgba: toRgb(color, gamut),
    oklch: formatOklch(color)
  });
  return tree;
};

/** Write the default seed palette one swatch at a time (used when empty). */
const writeSeed = async (gamut: Gamut): Promise<TokenTree> => {
  const seed = seedPalette();
  let tree: TokenTree = { $type: "color" };
  for (const [group, ramp] of Object.entries(seed)) {
    for (const [scale, color] of Object.entries(ramp)) {
      tree = await writeToken([group, scale], color, gamut);
    }
  }
  return tree;
};

const isEmpty = (tree: TokenTree): boolean =>
  Object.keys(tree).filter((k) => !k.startsWith("$")).length === 0;

export const App = (): JSX.Element => {
  const [profile, setProfile] = useState<ColorProfile | null>(null);
  const [tree, setTree] = useState<TokenTree | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  useEffect(() => {
    void (async (): Promise<void> => {
      await bridge.call("ensurePaletteCollection", { name: COLLECTION_NAME });
      const { profile: p } = await bridge.call("getColorProfile");
      setProfile(p);
      const { tree: initial } = await bridge.call("readTokens");
      setTree(isEmpty(initial) ? await writeSeed(gamutFor(p)) : initial);
    })();
  }, []);

  const palette = useMemo(() => (tree ? toPaletteVM(tree) : null), [tree]);
  const gamut = profile ? gamutFor(profile) : "srgb";

  // Resolve the selected swatch fresh from the current palette so its okLCH stays in
  // sync with the latest edit.
  const selected: SwatchVM | null = useMemo(() => {
    if (!palette || !selectedPath) return null;
    for (const ramp of palette.ramps) {
      for (const swatch of ramp.swatches) {
        if (swatch?.path.join("/") === selectedPath) return swatch;
      }
    }
    return null;
  }, [palette, selectedPath]);

  const onEdit = useCallback(
    (path: string[], color: Oklch): void => {
      void (async (): Promise<void> => {
        setTree(await writeToken(path, color, gamut));
      })();
    },
    [gamut]
  );

  if (!palette) {
    return (
      <main className="app">
        <p className="app__hint">Loading palette…</p>
      </main>
    );
  }

  return (
    <main className="app">
      <RampGrid
        palette={palette}
        gamut={gamut}
        selectedPath={selectedPath}
        onSelect={(swatch) => setSelectedPath(swatch.path.join("/"))}
      />
      {selected ? (
        <SwatchEditor
          key={selected.path.join("/")}
          swatch={selected}
          gamut={gamut}
          siblings={rampSiblings(palette, selected)}
          onEdit={onEdit}
        />
      ) : (
        <p className="app__hint">Select a swatch to edit its okLCH values.</p>
      )}
    </main>
  );
};
