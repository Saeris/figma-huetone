/**
 * One grid cell: a color swatch (Phase 2). Renders the swatch's okLCH directly via
 * CSS `oklch()` (the UI iframe is modern Chromium — SPEC §2.8), flags it when it
 * falls outside the document's active gamut (SPEC §2.7), and acts as a button that
 * selects the swatch for editing. Empty cells render an inert placeholder so ramps
 * stay aligned.
 */

import type { JSX } from "react";
import { formatOklch, type Gamut, inGamut } from "../color/index.js";
import type { SwatchVM } from "./model.js";
import "./Swatch.css";

export interface SwatchProps {
  /** The cell to render, or `null` for an empty slot in the ramp. */
  swatch: SwatchVM | null;
  /** Active gamut (from the document profile) — gates the out-of-gamut warning. */
  gamut: Gamut;
  /** Whether this swatch is the current editing selection. */
  selected: boolean;
  /** Select this swatch (only fired for non-empty cells). */
  onSelect: (swatch: SwatchVM) => void;
}

export const Swatch = ({
  swatch,
  gamut,
  selected,
  onSelect
}: SwatchProps): JSX.Element => {
  if (!swatch) {
    return <div className="swatch swatch--empty" aria-hidden="true" />;
  }

  const css = formatOklch(swatch.oklch);
  const outOfGamut = !inGamut(swatch.oklch, gamut);
  const label = `${swatch.group} ${swatch.scale}${outOfGamut ? " (out of gamut)" : ""}`;

  return (
    <button
      type="button"
      className={`swatch${selected ? " swatch--selected" : ""}`}
      style={{ background: css }}
      aria-label={label}
      aria-pressed={selected}
      onClick={() => onSelect(swatch)}
    >
      {outOfGamut ? (
        <span className="swatch__warning" role="img" aria-label="out of gamut">
          !
        </span>
      ) : null}
    </button>
  );
};
