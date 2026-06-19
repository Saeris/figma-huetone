/**
 * The ramp grid (Phase 2): the Huetone-style groups × scales layout. A header row
 * of scale labels, then one row per color group (its name, then its swatches across
 * the scale columns). A thin renderer over {@link PaletteVM} — all derivation lives
 * in `model.ts`; selection and editing are owned by the parent.
 */

import type { CSSProperties, JSX } from "react";
import type { Gamut } from "../color/index.js";
import type { PaletteVM, SwatchVM } from "./model.js";
import { Swatch } from "./Swatch.js";
import "./RampGrid.css";

export interface RampGridProps {
  palette: PaletteVM;
  gamut: Gamut;
  /** The currently-selected swatch path (joined), or null. */
  selectedPath: string | null;
  onSelect: (swatch: SwatchVM) => void;
}

export const RampGrid = ({
  palette,
  gamut,
  selectedPath,
  onSelect
}: RampGridProps): JSX.Element => (
  <div
    className="ramp-grid"
    // Custom CSS var for the column count; React's CSSProperties doesn't type `--*`.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- CSS custom property: React.CSSProperties has no index signature for `--*` vars.
    style={{ "--scale-count": palette.scales.length } as CSSProperties}
  >
    {/* Header: empty corner + one label per scale column. */}
    <div className="ramp-grid__corner" />
    {palette.scales.map((scale) => (
      <div key={scale} className="ramp-grid__scale-label">
        {scale}
      </div>
    ))}

    {/* One row per group: name label + swatches. */}
    {palette.ramps.map((ramp) => (
      <div key={ramp.group} className="ramp-grid__row" role="row">
        <div className="ramp-grid__group-label" role="rowheader">
          {ramp.group}
        </div>
        {ramp.swatches.map((swatch, i) => (
          <Swatch
            key={swatch ? swatch.scale : `empty-${palette.scales[i]}`}
            swatch={swatch}
            gamut={gamut}
            selected={swatch ? swatch.path.join("/") === selectedPath : false}
            onSelect={onSelect}
          />
        ))}
      </div>
    ))}
  </div>
);
