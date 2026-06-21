# Research scripts

Reproducible analysis code behind the palette evaluations in [`research/`](../). These are throwaway research utilities, not part of the plugin — they live here so a reader can re-run the findings rather than take them on faith.

They use **colorjs.io** (already a dependency of this repo) and run on Node directly (ESM, no build step).

## CVD distinguishability evaluations

[`cvd.mjs`](./cvd.mjs) — shared helpers: Machado et al. (2009) dichromacy simulation (protan/deutan/tritan, severity 1.0), Rec.709-luminance greyscale for monochromacy, Rec.709 relative luminance, and a `distinguishability()` routine that counts how many pairs of a categorical color set fall below ΔE2000 thresholds after CVD simulation (ΔE = 1 ≈ just-noticeable; we flag < 2 "invisible" and < 5 "weak").

### Harmony — [`eval-harmony.mjs`](./eval-harmony.mjs)

Reproduces [`../HARMONY_CVD_EVALUATION.md`](../HARMONY_CVD_EVALUATION.md). Self-contained — fetches Harmony's `source.json` over the network.

```sh
node research/scripts/eval-harmony.mjs
```

### @saeris/colors — [`eval-saeris-colors.mjs`](./eval-saeris-colors.mjs)

Reproduces [`../SAERIS_COLORS_CVD_EVALUATION.md`](../SAERIS_COLORS_CVD_EVALUATION.md). Parses the **built** package CSS (not the `src`, which contains commented-out alpha variants). Get the dist files first:

```sh
# in a scratch dir
npm pack @saeris/colors
tar -xf saeris-colors-*.tgz        # creates ./package/dist/*.css
# then, from the repo root:
node research/scripts/eval-saeris-colors.mjs <scratch>/package/dist
```

## What to look for in the output

The headline metric is the **monochromacy** row and the **luminance Y range** in each shade header. When the Y range across hues is near-zero (Harmony ≈ 1.9%, @saeris/colors ≈ 0.6–1.0%), monochromacy collapses _all_ pairs (ΔE ≈ 0) — because hues tuned to equal contrast share one luminance, and CVD/greyscale has nothing left to separate them by. That's the core finding both docs explain.
