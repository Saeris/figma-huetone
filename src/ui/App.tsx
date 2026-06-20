/**
 * The plugin UI (Phases 2–5): the ramp grid + numeric/slider okLCH editor over the
 * managed Base Tokens collection, plus the contrast views. On open it reads the
 * document color profile and the token tree, seeds a default palette if the
 * collection is empty, and renders the grid. Selecting a swatch opens the editor;
 * edits derive the gamut-mapped RGBA + okLCH source and persist live via `editToken`.
 * The editor shows the swatch's contrast on white and black; a live readout shows the
 * contrast of the current canvas selection (Polychrom-style). The contrast grid and
 * export arrive in later phases.
 */

import { type JSX, useCallback, useEffect, useMemo, useState } from "react";
import type { ColorProfile, SelectionContrast } from "../ipc/contract.js";
import type { TokenTree } from "../ipc/tokens.js";
import { createUiBridge } from "../ipc/channel.ui.js";
import { eventSignal } from "../ipc/signals.js";
import { formatOklch, type Gamut, type Oklch, toRgb } from "./color/index.js";
import {
  ContrastDisplay,
  ContrastGrid,
  type GridColor,
  SelectionContrastReadout
} from "./contrast/index.js";
import { ExportPanel } from "./export/index.js";
import {
  allSwatches,
  AxisEditor,
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

/** Live selection-contrast pair pushed from the sandbox (Polychrom-style). */
const selectionContrast = eventSignal(
  bridge,
  "selectionContrastChanged",
  (payload): SelectionContrast | null => payload.contrast,
  null
);

const WHITE: Oklch = { l: 1, c: 0, h: 0 };
const BLACK: Oklch = { l: 0, c: 0, h: 0 };

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

  // Contrast-grid scope (Phase 6): every swatch as foreground text, against a small
  // representative background set — white, black, and the lightest swatch of each
  // group (typical surface colors) — so the matrix stays useful rather than N×N.
  const gridColors = useMemo((): {
    foregrounds: GridColor[];
    backgrounds: GridColor[];
  } => {
    if (!palette) return { foregrounds: [], backgrounds: [] };
    const swatches = allSwatches(palette);
    const foregrounds = swatches.map((s) => ({
      id: s.path.join("/"),
      oklch: s.oklch
    }));
    const lightestPerGroup = palette.ramps
      .map((ramp) => ramp.swatches.find((s) => s !== null))
      .filter((s): s is SwatchVM => s != null)
      .map((s) => ({ id: s.path.join("/"), oklch: s.oklch }));
    const backgrounds: GridColor[] = [
      { id: "white", oklch: WHITE },
      { id: "black", oklch: BLACK },
      ...lightestPerGroup
    ];
    return { foregrounds, backgrounds };
  }, [palette]);

  const onEdit = useCallback(
    (path: string[], color: Oklch): void => {
      void (async (): Promise<void> => {
        setTree(await writeToken(path, color, gamut));
      })();
    },
    [gamut]
  );

  // --- Axis operations (Phase 3) ---
  // Rename/remove go straight to the sandbox; add seeds a neutral mid-tone swatch
  // at each cell of the new row/column via the normal edit path.
  const axisCall = useCallback(
    (pending: Promise<{ tree: TokenTree }>): void => {
      void (async (): Promise<void> => {
        setTree((await pending).tree);
      })();
    },
    []
  );

  const seedSwatch = (): Oklch => ({ l: 0.6, c: 0.02, h: 0 });

  const addGroup = useCallback(
    (name: string): void => {
      if (!palette) return;
      void (async (): Promise<void> => {
        let next: TokenTree | null = null;
        for (const scale of palette.scales) {
          next = await writeToken([name, scale], seedSwatch(), gamut);
        }
        if (next) setTree(next);
      })();
    },
    [palette, gamut]
  );

  const addScale = useCallback(
    (scale: string): void => {
      if (!palette) return;
      void (async (): Promise<void> => {
        let next: TokenTree | null = null;
        for (const ramp of palette.ramps) {
          next = await writeToken([ramp.group, scale], seedSwatch(), gamut);
        }
        if (next) setTree(next);
      })();
    },
    [palette, gamut]
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

      <details className="app__axes">
        <summary>Edit axes</summary>
        <AxisEditor
          groups={palette.ramps.map((r) => r.group)}
          scales={palette.scales}
          onRenameGroup={(from, to) =>
            axisCall(bridge.call("renameGroup", { from, to }))
          }
          onRemoveGroup={(name) =>
            axisCall(bridge.call("removeGroup", { name }))
          }
          onAddGroup={addGroup}
          onRenameScale={(from, to) =>
            axisCall(bridge.call("renameScale", { from, to }))
          }
          onRemoveScale={(scale) =>
            axisCall(bridge.call("removeScale", { scale }))
          }
          onAddScale={addScale}
        />
      </details>

      {selected ? (
        <>
          <SwatchEditor
            key={selected.path.join("/")}
            swatch={selected}
            gamut={gamut}
            siblings={rampSiblings(palette, selected)}
            onEdit={onEdit}
          />
          <section className="app__section">
            <h3 className="app__section-title">Contrast on white / black</h3>
            <ContrastDisplay text={selected.oklch} background={WHITE} />
            <ContrastDisplay text={selected.oklch} background={BLACK} />
          </section>
        </>
      ) : (
        <p className="app__hint">Select a swatch to edit its okLCH values.</p>
      )}

      <section className="app__section">
        <h3 className="app__section-title">Selection contrast</h3>
        <SelectionContrastReadout signal={selectionContrast} />
      </section>

      <details className="app__axes">
        <summary>Contrast grid</summary>
        <ContrastGrid
          foregrounds={gridColors.foregrounds}
          backgrounds={gridColors.backgrounds}
        />
      </details>

      <details className="app__axes">
        <summary>Export</summary>
        {tree ? <ExportPanel tree={tree} /> : null}
      </details>
    </main>
  );
};
