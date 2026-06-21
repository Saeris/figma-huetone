// Reproduces research/SAERIS_COLORS_CVD_EVALUATION.md.
//
// Parses the *built* @saeris/colors CSS (the published artifact, not the src —
// many colors are generated and the src carries commented-out alpha variants
// that a naïve parser mis-reads). Pass the path to a directory of the package's
// dist/*.css files, e.g. after `npm pack @saeris/colors` and extracting:
//
//   node research/scripts/eval-saeris-colors.mjs ./package/dist
//
// Solid steps are `--{hue}-{step}`; alpha variants `--{hue}-a{step}` (excluded).
// Light values live in :root; dark values under `&.dark`.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { VISION_TYPES, distinguishability, relativeLuminance } from "./cvd.mjs";

const dir = process.argv[2];
if (!dir) {
  process.stderr.write(
    "Usage: node eval-saeris-colors.mjs <path-to-dist-css-dir>\n"
  );
  process.exit(1);
}

const CHROMATIC = [
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose"
];
const SHADES = ["300", "500", "700"];

// Parse one color's CSS into { light: {step: oklch}, dark: {step: oklch} },
// taking only solid steps (not alpha) and only the sRGB oklch() declarations.
function parseColorCss(css) {
  const darkIdx = css.indexOf("&.dark");
  const lightSrc = darkIdx >= 0 ? css.slice(0, darkIdx) : css;
  const darkSrc = darkIdx >= 0 ? css.slice(darkIdx) : "";
  // `--hue-500: oklch(...);` but NOT `--hue-a500` — the [a-z]+- prefix then a
  // bare digit group means the "a" of an alpha var would be consumed by the
  // hue, leaving "a500" which fails the \d+ step match. Verified against reds.
  const grab = (src) => {
    const out = {};
    for (const m of src.matchAll(/--[a-z]+-(\d+):\s*(oklch\([^;]+\));/g)) {
      out[m[1]] = m[2];
    }
    return out;
  };
  return { light: grab(lightSrc), dark: grab(darkSrc) };
}

const palette = {};
for (const file of readdirSync(dir).filter((f) => f.endsWith(".css"))) {
  palette[file.replace(".css", "")] = parseColorCss(
    readFileSync(join(dir, file), "utf8")
  );
}

for (const mode of ["light", "dark"]) {
  for (const shade of SHADES) {
    const oklchs = CHROMATIC.map((h) => palette[h]?.[mode]?.[shade]).filter(
      Boolean
    );
    const ys = oklchs.map((o) => relativeLuminance(o) * 100);
    const yRange = (Math.max(...ys) - Math.min(...ys)).toFixed(1);
    process.stdout.write(
      `\n=== @saeris/colors ${mode} shade ${shade} (${oklchs.length} hues, Y range ${yRange}%) ===\n`
    );
    for (const type of VISION_TYPES) {
      const { belowInvisible, belowWeak, totalPairs, worst, worstPair } =
        distinguishability(oklchs, type);
      const [i, j] = worstPair;
      process.stdout.write(
        `  ${type.padEnd(7)} invisible(ΔE<2):${String(belowInvisible).padStart(3)}  ` +
          `weak(ΔE<5):${String(belowWeak).padStart(3)} / ${totalPairs}  ` +
          `worst ΔE=${worst.toFixed(1)} (${CHROMATIC[i]}↔${CHROMATIC[j]})\n`
      );
    }
  }
}
