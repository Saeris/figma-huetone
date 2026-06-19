/**
 * The palette UI (Phase 2): the groups × scales ramp grid and numeric okLCH editor,
 * plus the pure view-model that projects a DTCG {@link TokenTree} into a renderable
 * grid and the default seed palette.
 */

export {
  type PaletteVM,
  type RampVM,
  type SwatchVM,
  toPaletteVM
} from "./model.js";
export { SEED_SCALES, seedPalette } from "./seed.js";
export { RampGrid, type RampGridProps } from "./RampGrid.js";
export { Swatch, type SwatchProps } from "./Swatch.js";
export { SwatchEditor, type SwatchEditorProps } from "./SwatchEditor.js";
