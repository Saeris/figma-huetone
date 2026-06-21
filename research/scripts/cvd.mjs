// Shared CVD-simulation + color-difference helpers used by the palette
// evaluations in research/. Pure functions, no I/O. Depends only on colorjs.io
// (already a dependency of this repo).
//
// See research/HARMONY_CVD_EVALUATION.md and
// research/SAERIS_COLORS_CVD_EVALUATION.md for the findings these produce.

import Color from "colorjs.io";

// Machado, Oliveira & Fernandes (2009) CVD simulation matrices at severity 1.0
// (full dichromacy). These operate on LINEAR-light sRGB. This is the same model
// used by Chrome DevTools and most accessibility simulators.
// https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html
const MATRICES = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998]
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881]
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039]
  ]
};

const srgbToLinear = (v) =>
  v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const linearToSrgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
const clamp = (v) => Math.min(1, Math.max(0, v));

// Simulate how a color appears under a given vision type.
//  - "normal"            → unchanged
//  - "protan"/"deutan"/"tritan" → Machado dichromacy
//  - "mono"              → Rec.709 relative-luminance greyscale (monochromacy)
// `input` is anything colorjs.io accepts (hex, "oklch(...)", etc.).
export function simulate(input, type) {
  const color = new Color(input).to("srgb");
  let [r, g, b] = color.coords.map(clamp).map(srgbToLinear);

  if (type === "mono") {
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    [r, g, b] = [y, y, y];
  } else if (type !== "normal") {
    const m = MATRICES[type];
    if (!m) throw new Error(`Unknown vision type: ${type}`);
    [r, g, b] = [
      m[0][0] * r + m[0][1] * g + m[0][2] * b,
      m[1][0] * r + m[1][1] * g + m[1][2] * b,
      m[2][0] * r + m[2][1] * g + m[2][2] * b
    ];
  }
  return new Color("srgb", [r, g, b].map(linearToSrgb).map(clamp));
}

export const VISION_TYPES = ["normal", "protan", "deutan", "tritan", "mono"];

// Rec.709 relative luminance (0–1) of a color — the WCAG luminance formula.
export function relativeLuminance(input) {
  const [r, g, b] = new Color(input)
    .to("srgb")
    .coords.map(clamp)
    .map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Given a list of colors meant to be used as a *categorical* set, simulate them
// under `type` and report how many pairs fall below distinguishability
// thresholds. ΔE = 1 is a just-noticeable difference (ΔE2000); we treat
// ΔE < 2 as "invisible" and ΔE < 5 as "weak".
export function distinguishability(
  colors,
  type,
  { invisible = 2, weak = 5 } = {}
) {
  const sims = colors.map((c) => simulate(c, type));
  let belowInvisible = 0;
  let belowWeak = 0;
  let worst = Infinity;
  let worstPair = [-1, -1];
  for (let i = 0; i < sims.length; i++) {
    for (let j = i + 1; j < sims.length; j++) {
      const dE = sims[i].deltaE2000(sims[j]);
      if (dE < invisible) belowInvisible++;
      if (dE < weak) belowWeak++;
      if (dE < worst) {
        worst = dE;
        worstPair = [i, j];
      }
    }
  }
  const totalPairs = (sims.length * (sims.length - 1)) / 2;
  return { belowInvisible, belowWeak, totalPairs, worst, worstPair };
}
