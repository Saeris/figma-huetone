/**
 * Phase 1 harness UI (SPEC §5). This is NOT the real Huetone UI yet — it's a thin
 * surface that exercises the persistence spine end to end so we can SEE it working:
 *
 * - read the document color profile (picks the gamut-mapping target),
 * - read the managed Base Tokens collection into a canonical DTCG tree,
 * - write one token (okLCH → gamut-mapped RGBA + `oklch()` code syntax) and confirm
 *   it round-trips back through Figma.
 *
 * The color math lives in `src/ui/color`; the UI derives the render value and the
 * okLCH source string, the sandbox just persists them. The ramp grid, charts, and
 * real controls arrive in later phases.
 */

import { type JSX, useEffect, useState } from "react";
import type { ColorProfile, TokenEdit } from "../ipc/contract.js";
import type { TokenTree } from "../ipc/tokens.js";
import { createUiBridge } from "../ipc/channel.ui.js";
import { formatOklch, type Gamut, type Oklch, toRgb } from "./color/index.js";
import { Button } from "./components/Button.js";
import "./App.css";

const bridge = createUiBridge();

/** The gamut we map okLCH into, per the document profile (SPEC §2.7). */
const gamutFor = (profile: ColorProfile): Gamut =>
  profile === "DISPLAY_P3" ? "p3" : "srgb";

/**
 * Build the edit payload from a canonical okLCH color: derive the gamut-mapped RGBA
 * render value and serialize the okLCH source string. `modeId` is omitted in Phase 1
 * so the sandbox targets the collection's default mode.
 */
const editFor = (path: string[], color: Oklch, gamut: Gamut): TokenEdit => ({
  path,
  rgba: toRgb(color, gamut),
  oklch: formatOklch(color)
});

export const App = (): JSX.Element => {
  const [profile, setProfile] = useState<ColorProfile | null>(null);
  const [tree, setTree] = useState<TokenTree | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async (): Promise<void> => {
      await bridge.call("ensurePaletteCollection", { name: "Huetone Base" });
      const { profile: p } = await bridge.call("getColorProfile");
      setProfile(p);
      const { tree: t } = await bridge.call("readTokens");
      setTree(t);
    })();
  }, []);

  const onWriteSample = async (): Promise<void> => {
    if (!profile) return;
    setBusy(true);
    try {
      // A representative red 500, authored in okLCH. Round-trips losslessly via
      // code syntax even if gamut-clipped for the render value.
      const edit = editFor(
        ["red", "500"],
        { l: 0.627, c: 0.21, h: 25.4 },
        gamutFor(profile)
      );
      const { tree: t } = await bridge.call("editToken", edit);
      setTree(t);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="app">
      <h2 className="app__title">Huetone — persistence spine</h2>
      <p className="app__hint">
        Color profile: <strong>{profile ?? "…"}</strong>
      </p>

      <footer className="app__actions">
        <Button
          variant="brand"
          onClick={() => void onWriteSample()}
          disabled={busy || !profile}
        >
          {busy ? "Writing…" : "Write sample red/500"}
        </Button>
        <Button onClick={() => void bridge.call("close")}>Close</Button>
      </footer>

      <pre className="app__tree">
        {tree ? JSON.stringify(tree, null, 2) : "Reading tokens…"}
      </pre>
    </main>
  );
};
