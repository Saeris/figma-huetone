/**
 * The palette UI (Phase 2): the groups × scales ramp grid and numeric okLCH editor,
 * plus the pure view-model that projects a DTCG {@link TokenTree} into a renderable
 * grid and the default seed palette.
 */

export {
  type PaletteVM,
  type RampVM,
  rampSiblings,
  type SwatchVM,
  toPaletteVM
} from "./model.js";
export {
  type Channel,
  CHANNEL_DOMAIN,
  chromaCeiling,
  clampChannel,
  sampleChannel,
  withChannel
} from "./channel.js";
export { SEED_SCALES, seedPalette } from "./seed.js";
export { RampGrid, type RampGridProps } from "./RampGrid.js";
export { Swatch, type SwatchProps } from "./Swatch.js";
export {
  ChannelHistogram,
  type ChannelHistogramProps
} from "./ChannelHistogram.js";
export { ChannelSlider, type ChannelSliderProps } from "./ChannelSlider.js";
export {
  type ChannelSiblings,
  SwatchEditor,
  type SwatchEditorProps
} from "./SwatchEditor.js";
