// Reproduces research/HARMONY_CVD_EVALUATION.md.
//
// Fetches the Harmony palette source, then for each shade level evaluates how
// distinguishable its chromatic hues remain under each vision type.
//
// Run from the repo root:  node research/scripts/eval-harmony.mjs
// Requires network access (fetches Harmony's source.json) and colorjs.io.

import { VISION_TYPES, distinguishability, relativeLuminance } from "./cvd.mjs";

const HARMONY_SOURCE =
  "https://raw.githubusercontent.com/evilmartians/harmony/78162e9e4d749051e926650f3396b8c2727b2aba/source.json";

// The 17 chromatic hues (grays excluded), in Tailwind order.
const CHROMATIC = [
  "Red",
  "Orange",
  "Amber",
  "Yellow",
  "Lime",
  "Green",
  "Emerald",
  "Teal",
  "Cyan",
  "Sky",
  "Blue",
  "Indigo",
  "Violet",
  "Purple",
  "Fuchsia",
  "Pink",
  "Rose"
];
const SHADES = ["300", "500", "700"];

const res = await fetch(HARMONY_SOURCE);
if (!res.ok) throw new Error(`Failed to fetch Harmony source: ${res.status}`);
// source.json is keyed "Hue/Shade" → DTCG token with a hex `$value`.
const tokens = await res.json();

for (const shade of SHADES) {
  const hexes = CHROMATIC.map((h) => tokens[`${h}/${shade}`]?.$value).filter(
    Boolean
  );

  // Luminance spread across hues — the root-cause metric (near-zero spread
  // means CVD/monochromacy has nothing to separate the hues by).
  const ys = hexes.map((h) => relativeLuminance(h) * 100);
  const yRange = (Math.max(...ys) - Math.min(...ys)).toFixed(1);

  process.stdout.write(
    `\n=== Harmony shade ${shade} (${hexes.length} hues, luminance Y range ${yRange}%) ===\n`
  );
  for (const type of VISION_TYPES) {
    const { belowInvisible, belowWeak, totalPairs, worst, worstPair } =
      distinguishability(hexes, type);
    const [i, j] = worstPair;
    process.stdout.write(
      `  ${type.padEnd(7)} invisible(ΔE<2):${String(belowInvisible).padStart(3)}  ` +
        `weak(ΔE<5):${String(belowWeak).padStart(3)} / ${totalPairs}  ` +
        `worst ΔE=${worst.toFixed(1)} (${CHROMATIC[i]}↔${CHROMATIC[j]})\n`
    );
  }
}
