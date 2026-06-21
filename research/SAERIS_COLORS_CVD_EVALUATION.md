# @saeris/colors — CVD Evaluation

> An **original analysis** paralleling [HARMONY_CVD_EVALUATION.md](./HARMONY_CVD_EVALUATION.md): the same Machado-2009 simulation + ΔE2000 pipeline applied to [`@saeris/colors`](https://github.com/Saeris/colors) — the user's own fork of Harmony, which widened the ramp (25→ adds step 25), added symmetrical light/dark pairs, and **hand-tuned each color's hue/chroma to add distinctiveness against the luminance-uniformity problem** Harmony has. The question: did the hand-tuning fix it? 2026-06-21.

**Data source:** the _built npm artifact_ `@saeris/colors@0.1.2` (`dist/*.css`), not the `src/*.ts` (many colors are generated; the source files also carry commented-out alpha variants that broke a naïve parser — see §5). Solid steps parsed as `--{hue}-{step}` (alpha `--{hue}-a{step}` excluded), light from `:root`, dark from `&.dark`.

---

## 1. What's different from Harmony

|                | Harmony                  | @saeris/colors                                           |
| -------------- | ------------------------ | -------------------------------------------------------- |
| Steps per ramp | 11 (50–950)              | **12** (adds **25**)                                     |
| Modes          | light only (per swatch)  | **symmetrical light + dark** pairs                       |
| Format         | hex + oklch              | **OKLCH-native** (lossless) + P3 + alpha variants        |
| Tuning         | algorithmic (Harmonizer) | **hand-tuned** hue/chroma per step "by perception/vibes" |
| Hues           | 25 (Tailwind + grays)    | 25 (same set)                                            |

The hand-tuning is visible in the source: e.g. red's hue walks 17.25 → 22 → 19.8 → 19.7… and chroma rises then falls across the ramp, rather than holding constant.

---

## 2. Results (17 chromatic hues, pairs of 136)

ΔE2000 between hue pairs after CVD simulation. ΔE<2 ≈ invisible difference; ΔE<5 ≈ weak; ΔE=1 is a just-noticeable difference.

### Light mode

| Shade   | Vision   | <2 (invisible) | <5 (weak) | worst              |
| ------- | -------- | -------------- | --------- | ------------------ |
| **300** | normal   | 0              | 0         | green↔emerald 5.9  |
|         | protan   | 9              | 27        | indigo↔violet 0.4  |
|         | deutan   | 11             | 29        | blue↔indigo 0.4    |
|         | tritan   | 3              | 14        | red↔rose 1.3       |
|         | **mono** | **136**        | **136**   | cyan↔sky 0.0       |
| **500** | normal   | 0              | 0         | fuchsia↔pink 9.0   |
|         | protan   | 6              | 17        | indigo↔violet 0.9  |
|         | deutan   | 7              | 16        | blue↔indigo 0.8    |
|         | tritan   | 1              | 10        | teal↔cyan 1.8      |
|         | **mono** | **136**        | **136**   | orange↔purple 0.0  |
| **700** | normal   | 0              | 0         | fuchsia↔pink 7.6   |
|         | deutan   | 6              | 20        | indigo↔violet 0.8  |
|         | **mono** | **136**        | **136**   | yellow↔emerald 0.0 |

### Dark mode (shade 500)

| Vision   | <2      | <5  | worst             |
| -------- | ------- | --- | ----------------- |
| normal   | 0       | 0   | fuchsia↔pink 9.4  |
| protan   | 6       | 15  | indigo↔violet 1.1 |
| deutan   | 8       | 19  | yellow↔lime 0.9   |
| tritan   | 1       | 9   | teal↔cyan 1.9     |
| **mono** | **135** | 136 | sky↔fuchsia 0.0   |

### Worst deutan pairs, light shade 500 (ΔE<3)

blue↔indigo 0.8 · amber↔yellow 1.1 · yellow↔lime 1.2 · indigo↔violet 1.2 · violet↔purple 1.4 · amber↔lime 1.5 · blue↔violet 1.6 · indigo↔purple 2.4 · blue↔purple 2.6

---

## 3. The verdict — honest and a little surprising

**At a single shade across hues, @saeris/colors has the same structural CVD failure as Harmony.** Monochromacy collapses **all 136 pairs (ΔE≈0)** at every shade, and deutan/protan lose 6–11 pairs — essentially indistinguishable from Harmony's numbers.

Where the hand-tuning _does_ help, measurably:

- **Normal-vision separation is better** (worst ΔE 9.0 vs Harmony's 7.9 at shade 500) — the hue/chroma distinctiveness gives more headroom for full-color vision.
- It's a genuinely nicer, more characterful palette to look at, with lossless okLCH + dark pairs + alpha + P3 — real improvements on every axis _except_ the CVD one.

But it **cannot** fix the CVD collapse, and the reason is structural:

> The hand-tuning moved **chroma and hue** — the exact channels CVD compresses (protan/deutan) or removes entirely (mono). The **lightness** was held nearly constant across hues at each shade to preserve contrast consistency. So once color discrimination drops, there's nothing left to tell the hues apart.

### The luminance evidence

Across the 17 chromatic hues at each light shade, the relative-luminance (Y) spread is _tiny_ — even tighter than Harmony's:

| shade | Y range across 17 hues | OKLCH L range |
| ----- | ---------------------- | ------------- |
| 300   | **0.6%** (61.8–62.4)   | 2.0           |
| 500   | **1.0%** (37.4–38.3)   | 4.0           |
| 700   | **0.5%** (13.9–14.3)   | 3.1           |

(Harmony @500 was Y range 1.9%.) Hand-tuning hue/chroma while pinning luminance is, mathematically, **invisible to CVD**. This is the same finding as Harmony, now confirmed on a second, independently-tuned palette — which makes the conclusion robust: **perceptual hue tweaking at a fixed lightness is not a CVD fix.**

---

## 4. Implications for our tool (sharpened)

1. **A palette can be beautiful, okLCH-native, APCA-tuned, dark-mode-paired, _and_ hand-perfected for distinctiveness, and still fail CVD at a fixed shade.** The only reliable check is measured ΔE-under-simulation. This is now demonstrated on _two_ palettes — strong justification for the feature.
2. **The fix the data points to:** to make a _categorical_ set CVD-safe, you must let **lightness vary across the hues** (so mono/CVD has a luminance signal to separate them) — which trades against equal-contrast/equal-weight. Our tool should:
   - Detect when a horizontal slice (one shade × many hues) is being used categorically, and **measure its CVD ΔE**, flagging collapses.
   - Optionally **suggest luminance separation** for categorical sets (the opposite of what you'd do for a single ramp).
3. **This validates separating "ramp" from "categorical set" as first-class modes** (see [PALETTE_APPLICATIONS.md](./PALETTE_APPLICATIONS.md)). @saeris/colors is excellent as a set of _ramps_ (use violet-500 for violet things); its CVD weakness only appears when one shade is sampled across hues as categories — which is exactly the data-viz/status use where tools like IBM Carbon deliberately _alternate_ luminance.
4. **The applied theme dodges the problem in practice.** The `@saeris/ui` Figma theme narrows usage to **Primary (a Violet alias) / Neutral / Semantic (Info, Callout/warning, etc.)** — it never asks the user to distinguish 17 same-lightness hues at once. Semantic colors (red=danger, green=success, amber=warning) are few and chosen for meaning, and _should_ be checked pairwise under CVD (red↔green is the classic failure), but that's a 3–5 color check, not a 17-hue sweep.

---

## 5. Reproducibility & corrections

- **Data:** `@saeris/colors@0.1.2` npm tarball, `dist/*.css`. Solid steps only.
- **A correction worth recording:** an initial pass parsed the `src/*.ts` files and accidentally matched the **commented-out alpha variants** (`// a500: …`), producing wrong (and misleadingly _better_) numbers. Re-running on the built CSS artifact — which names solids and alphas distinctly — gave the correct, sobering result above. Lesson for our own tooling: parse built artifacts, and never trust a digit-only key match against a file that contains alpha-prefixed variants.
- **Model:** Machado et al. (2009) severity-1.0 matrices (protan/deutan/tritan) + Rec.709 luminance greyscale (mono); colorjs.io `deltaE2000`.
