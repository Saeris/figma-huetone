/**
 * Live selection-contrast readout (Phase 5, SPEC §2.3) — the Polychrom-style panel.
 * Subscribes to the sandbox's `selectionContrastChanged` event, converts the
 * extracted RGBA fg/bg to okLCH, and renders the {@link ContrastDisplay}. Shows a
 * hint when the selection doesn't yield a usable pair.
 *
 * The sandbox sends RGBA (it has no colorjs); all the color math is here.
 */

import type { JSX } from "react";
import type { Signal } from "signal-polyfill";
import type { SelectionColor } from "../../ipc/contract.js";
import { useSignal } from "../../ipc/react.js";
import { type Oklch, rgbToOklch } from "../color/index.js";
import { ContrastDisplay } from "./ContrastDisplay.js";
import "./SelectionContrastReadout.css";

const toOklch = (color: SelectionColor): Oklch =>
  rgbToOklch(color.rgba, "srgb");

export interface SelectionContrastReadoutProps {
  /**
   * The live selection-contrast signal (an `eventSignal` over
   * `selectionContrastChanged`), passed in so the bridge wiring stays in `App`.
   */
  signal: Signal.State<{
    foreground: SelectionColor;
    background: SelectionColor;
  } | null>;
}

export const SelectionContrastReadout = ({
  signal
}: SelectionContrastReadoutProps): JSX.Element => {
  const pair = useSignal(signal);

  if (!pair) {
    return (
      <p className="selection-contrast__hint">
        Select a layer (and optionally its background) to check its contrast.
      </p>
    );
  }

  return (
    <div className="selection-contrast">
      <div className="selection-contrast__pair">
        <span className="selection-contrast__role">
          {pair.foreground.label} on {pair.background.label}
        </span>
      </div>
      <ContrastDisplay
        text={toOklch(pair.foreground)}
        background={toOklch(pair.background)}
      />
    </div>
  );
};
