/**
 * Contrast UI (SPEC §2.3/§2.5/§2.6): the APCA + WCAG display for a color pair, the
 * live selection-contrast readout (Polychrom-style), and the contrast grid (the
 * contrast.tools-style pairing matrix).
 */

export {
  ContrastDisplay,
  type ContrastDisplayProps
} from "./ContrastDisplay.js";
export {
  type CellVerdict,
  contrastGrid,
  type ContrastGridModel,
  type FontContext,
  type GridColor
} from "./grid.js";
export { ContrastGrid, type ContrastGridProps } from "./ContrastGrid.js";
export {
  SelectionContrastReadout,
  type SelectionContrastReadoutProps
} from "./SelectionContrastReadout.js";
