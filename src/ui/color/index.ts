/**
 * The color engine (SPEC §2.9): okLCH as the canonical representation, with conversion + perceptual gamut mapping to sRGB/P3 and APCA/WCAG contrast. Pure math over `colorjs.io/fn`; lives entirely in the UI thread.
 */

export {
  type Oklch,
  type Rgb,
  type Gamut,
  inGamut,
  maxChroma,
  toRgb,
  rgbToOklch,
  formatOklch,
  parseOklch
} from "./convert.js";
export { apca, wcag21 } from "./contrast.js";
