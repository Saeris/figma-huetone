/**
 * The contrast grid (Phase 6, SPEC §2.6) — the contrast.tools-style matrix. Rows are
 * foreground (text) colors, columns are background colors; each cell renders a small
 * text sample of that pairing and flags whether it passes APCA (and WCAG AA) at the
 * chosen font size and weight. The size/weight selectors re-filter the pass/fail
 * thresholds live without recomputing the (pair-intrinsic) Lc.
 *
 * Scope is the caller's: it passes the foreground and background sets, so the grid
 * never blows up to a full N×N over every swatch.
 */

import { type JSX, useMemo, useState } from "react";
import { formatOklch } from "../color/index.js";
import { type CellVerdict, contrastGrid, type GridColor } from "./grid.js";
import "./ContrastGrid.css";

export interface ContrastGridProps {
  foregrounds: GridColor[];
  backgrounds: GridColor[];
}

/** Font sizes offered in the filter (px). */
const SIZES = [12, 14, 16, 18, 24, 36] as const;
/** Font weights offered in the filter. */
const WEIGHTS = [400, 500, 700] as const;

/** One matrix cell: a text sample over the background, with a pass marker. */
const Cell = ({
  fg,
  bg,
  verdict
}: {
  fg: GridColor;
  bg: GridColor;
  verdict: CellVerdict;
}): JSX.Element => (
  <td
    className="contrast-grid__cell"
    style={{ background: formatOklch(bg.oklch), color: formatOklch(fg.oklch) }}
    title={`${fg.id} on ${bg.id}: Lc ${Math.round(verdict.lc)}, ${verdict.ratio.toFixed(2)}:1`}
  >
    <span className="contrast-grid__sample">Aa</span>
    <span
      className={`contrast-grid__mark contrast-grid__mark--${verdict.apcaPass ? "pass" : "fail"}`}
      aria-label={
        verdict.apcaPass
          ? `${fg.id} on ${bg.id} passes`
          : `${fg.id} on ${bg.id} fails`
      }
    >
      {verdict.apcaPass ? "✓" : "✕"}
    </span>
  </td>
);

export const ContrastGrid = ({
  foregrounds,
  backgrounds
}: ContrastGridProps): JSX.Element => {
  const [sizePx, setSizePx] = useState<number>(16);
  const [weight, setWeight] = useState<number>(400);

  const model = useMemo(
    () => contrastGrid(foregrounds, backgrounds, { sizePx, weight }),
    [foregrounds, backgrounds, sizePx, weight]
  );

  return (
    <div className="contrast-grid">
      <div className="contrast-grid__filters">
        <label className="contrast-grid__filter">
          <span>Size</span>
          <select
            value={sizePx}
            onChange={(e) => setSizePx(Number(e.target.value))}
          >
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}px
              </option>
            ))}
          </select>
        </label>
        <label className="contrast-grid__filter">
          <span>Weight</span>
          <select
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
          >
            {WEIGHTS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="contrast-grid__scroll">
        <table className="contrast-grid__table">
          <thead>
            <tr>
              <th />
              {backgrounds.map((bg) => (
                <th key={bg.id} className="contrast-grid__col-head">
                  {bg.id}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {foregrounds.map((fg, f) => (
              <tr key={fg.id}>
                <th scope="row" className="contrast-grid__row-head">
                  {fg.id}
                </th>
                {backgrounds.map((bg, b) => (
                  <Cell
                    key={bg.id}
                    fg={fg}
                    bg={bg}
                    verdict={model.cells[f][b]}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
