# Color & Contrast Research

> Study of [colorandcontrast.com](https://colorandcontrast.com/) — Nate Baldwin's interactive guide to the science of color and contrast, widely regarded as essential reading for building accessible color systems. (Baldwin authored Adobe's [Leonardo](https://leonardocolor.io/) adaptive-color tooling, so the guide's perspective is the same "generate accessible colors by contrast target" lineage our tool sits in.) Crawled in full (~75 pages across 11 sections) via Playwright on 2026-06-20, with extra attention to vision deficiencies per the brief.

This is a **conceptual foundation** doc, not a benchmark of a competing tool. Its job is to deepen our understanding of human vision/perception and to extract concrete implications for what our plugin should help users do. Sections below mirror the guide; each ends with the implications that matter for us. The closing **§13** is the actionable synthesis.

---

## 1. How the eye works (physiology + color vision)

- **Cornea / lens / pupil & iris**: focus and meter light. Shape variance → myopia / hyperopia / astigmatism; lens stiffening with age → presbyopia.
- **Retina**: ~7M **cones** (photopic / bright-light, color) concentrated in the **fovea** (best acuity); ~120M **rods** (scotopic / low-light, monochromatic). CVD = missing/abnormal cones.
- **Trichromacy**: all perceived hue = mixtures of three cone responses (L/M/S ≈ red/green/blue sensitivities).
- **Color opponent process**: cone signals combine/cancel into three channels — **red–green, blue–yellow, and luminance**. This is the biological basis of every opponent/uniform color space (CIELAB's a/b, OKLAB's a/b, and the separate L). It's _why_ okLCH separates lightness from chroma/hue the way it does.

**Implication:** our okLCH model isn't an arbitrary convenience — it mirrors the opponent-channel structure of vision. The L channel ≈ the luminance channel; C/H ≈ the chromatic channels.

---

## 2. Contrast & visual acuity (the "why" behind APCA)

- **Contrast sensitivity** — ability to distinguish object from background; varies per person (cataracts, optic-nerve damage…), by lighting and **spatial frequency**. WCAG 1.4.3 is a _general_ threshold, not a personal one.
- **Contrast polarity** — dark-on-light = **negative** polarity; light-on-dark = **positive**. "Contrast sensitivity can differ between positive and negative environments. **Dark mode may need higher relative-luminance contrast than light mode.** The APCA formula accounts for the perceptual differences of contrast polarity." ← the signed-Lc core of APCA.
- **Stevens' power law** — perceived change ≠ actual change (a power function). Directly: "When creating a color scale, [it] can inform how to make the progression of tints and shades appear perceptually balanced." (Why evenly-stepped L _looks_ balanced and linear RGB steps don't.)
- **Lateral inhibition** (White's illusion, Mach bands) — vision exaggerates luminance edges. "Analyzing colors as a color scale can be affected by [it]." Adjacent swatches influence each other.
- **Visual acuity** — "**Lighter font weights (or smaller text) should use higher contrast colors.**" This is precisely the APCA font-lookup table our `fontLookup.ts` encodes.
- **Dynamic range / optical glare** — environment + screen brightness affect legibility; support increase-/high-contrast modes; offer personalization.

**Implication:** APCA exists because contrast is perceptual, polarity-dependent, and typography-dependent — exactly the three things the guide hammers. Our APCA + font-lookup + (future) per-polarity evaluation is the right model. WCAG remains the _compliance floor_.

---

## 3. Sensory adaptations

- **Chromatic adaptation** ("the dress", afterimages) — vision normalizes color under colored light; appearance ≠ measurement.
- **Contrast adaptation** (Chubb illusion) — surrounding contrast shifts perceived contrast. "**Avoid designing an entire interface in high contrast** — viewers adapt and lose the ability to discriminate hierarchy."
- **Light & dark adaptation** — follows Stevens' power law; color appearance shifts via Hunt / Bezold–Brücke / Purkinje during adaptation.

**Implication:** measured contrast and _perceived_ contrast diverge with surroundings — a reason to show contrast numbers (objective) rather than trust the eye, and a reason a palette needs hierarchy, not uniform max-contrast.

---

## 4. Visual impairments — incl. Color Vision Deficiency (focus area)

Refractive/age conditions (myopia, hyperopia, presbyopia, cataracts, astigmatism, photophobia) mostly reduce acuity / increase glare → the guidance is consistent: **support WCAG 1.4.3, support increase-/high-contrast modes, and offer personalization** (some users need _more_ contrast, some with light sensitivity need _less_).

### Color Vision Deficiency (CVD)

Prevalence: **~8% of males, ~0.5% of females**. Three categories:

| Category                                       | Cause                                           | Types & prevalence (male)                                                                                  |
| ---------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Anomalous trichromacy** (most common, ~6% M) | a cone pigment is _shifted_ in sensitivity      | **Deuteranomaly** (green/MWS) 4.63% · **Protanomaly** (red/LWS) 1.08% · **Tritanomaly** (blue/SWS) 0.0002% |
| **Dichromacy**                                 | a cone pigment is _missing_ (two sensitivities) | **Deuteranopia** (green) 1.27% · **Protanopia** (red) 1.01% · **Tritanopia** (blue) 0.0001%                |
| **Monochromacy** (very rare)                   | one/no functioning cone types                   | scotopic · achromatopsia (rod) · blue-cone · cerebral                                                      |

**Deutan + protan ("red–green") dominate.** Tritan is rare.

The guide's design guidance is **repeated on every CVD page** and is the most concrete steer for our tool:

1. "Most issues can be resolved by compliance with **WCAG 1.4.1 (use of color)** and **1.4.3 (contrast minimum)**." → never rely on hue alone; keep luminance contrast.
2. "When color identification is important to all sighted users, use a color tool to **evaluate color difference (ΔE) for each color deficiency type.**" → the explicit feature recommendation.
3. **Critical caveat (anomalous-trichromacy page):** "Most simulation tools imply a _fixed_ experience for each vision type. Anomalous trichromats vary in strength… Reliance on these tools (plus subjective decisions) **can result in falsely identifying safe colors.**"

**Implication (high value):** the right accessibility feature is **not** just a CVD _preview filter_ (necessary but gives false confidence) — it's a **ΔE evaluation under each CVD projection**: simulate each palette color through protan/deutan/tritan, compute ΔE2000 between the simulated pairs, and flag pairs that collapse below a just-noticeable threshold. See §6 and §13.

---

## 5. Color appearance phenomena (why ramps need hue/chroma tuning)

- **Abney effect** (purity-on-hue) + **Bezold–Brücke shift** (luminance-on-hue): hue _appears_ to shift as you add white or change intensity. "When creating color scales/tints, **artificially shifting the hue** will help combat the Abney effect"; "cool colors should shift toward warmer hues as they get lighter" for natural appearance. ← this is exactly why Huetone (and we) expose a **per-tone hue** control; an even-hue okLCH ramp can look "off".
- **Helmholtz–Kohlrausch effect** (chromatic luminance): higher chroma is _perceived_ as higher lightness. "**Do not subjectively match colors by apparent lightness** — use accurate measurements (color appearance models). Use a tool to check contrast." ← argues for measured L and a contrast tool over eyeballing; also means equal-L swatches at different chroma won't _look_ equal-lightness.
- **Simultaneous / successive contrast, Bezold effect, spatial color mixing**: adjacent and previously-viewed colors shift perceived hue/chroma/lightness. Relevant to how swatches read in a grid; supports a "squint/greyscale" view to judge lightness alone.
- **Hunt effect / Purkinje shift**: in low light / dark mode, perceived colorfulness drops and reds darken. "**Decreasing chroma of colors in dark mode** gives a more natural appearance." ← informs dark-theme generation.
- **Chromostereopsis**: juxtaposed high-chroma red/blue "vibrate". "Text should never use a combination of colors that create this illusion." ← a warn-able palette anti-pattern.

**Implication:** algorithmic okLCH seeding is a _starting point_; the perceptual effects above are why a good tool keeps **manual per-channel chart control** (L/C/H per tone) on top of generation — which our chart-based editor provides.

---

## 6. Measurements & formulas (the math we implement)

- **APCA** — "set to replace WCAG relative-luminance… accounts for spatial frequency, simultaneous contrast, light & dark adaptation. **Not yet an official standard** — don't replace WCAG until released; a backwards-compatible mode exists. Dark-on-light ≠ light-on-dark; **dark mode must be independently evaluated.**" Confirms our APCA-alongside-WCAG design.
- **Relative luminance** — the WCAG-2 Y-from-XYZ ratio. "**Performs poorly for dark themes**; light text on dark needs increased relative-luminance contrast." (Same formula as our `wcag21` and contrast.tools' `legacyContrast`.)
- **Color difference (ΔE)** — "**Delta E 2000** is the latest; **ΔE = 1 is a just-noticeable difference (JND).** CVD-'safe' colors must pass a threshold of color difference for their _simulated_ counterparts." ← the algorithm for the CVD feature.
- **Color confusion lines** — per-CVD lines in CIE xy where colors are confused (converge at the _copunctal point_). "Confusion lines **alone are insufficient** — additional analysis of simulated colors should be done using ΔE." (So: confusion lines explain _why_; ΔE on simulated colors is the _check_.)
- **Color interpolation** — lists ~17 spaces (lab/oklab/lch/oklch/hsluv/p3/rec2020/ictcp/jzazbz…). Guidance: "**cartesian** spaces for **monochromatic** interpolation; **cylindrical** transformations for **multi-hue / analogous**. Uniform-space interpolation is perceptually grounded — but scientific models aren't necessarily _aesthetic_." ← how to generate ramp steps (interpolate L cartesianly, hue cylindrically), with manual override.
- **Color temperature** (Kelvin) — warm/cool; complementary pairs oppose in temperature.

**Implication:** we already have APCA + WCAG + okLCH gamut-mapping. The **missing measurement is ΔE2000 + CVD simulation** — the guide's most-repeated recommendation and the clearest net-new feature.

---

## 7. Color spaces & models (validates our stack)

- **Color appearance / uniform color spaces** (CIELAB, CIELUV, CAM02, CAM16, **OKLAB**) — "**better color spaces for evaluating color and creating color scales.** All share the same L\* lightness; they differ in chromaticity." OKLAB (Ottosson 2020, based on CAM16-UCS + IPT) is "more perceptually uniform, blends well, behaves well numerically." ← endorses our okLCH choice as current best-practice.
- **Repeated humility caveat**: "Uniform color spaces are **linear** models; human perception is **non-linear**. **Do not rely on these alone** to create aesthetically balanced colors." ← reinforces §5: generation + manual tuning.
- **Gamut / sRGB / Display-P3** — P3 is "much more vibrant… not supported everywhere… **always define an sRGB fallback**… do not directly convert." Out-of-gamut colors get **gamut-mapped** to the nearest in-gamut color. ← matches our "P3 when the document allows, gamut-map otherwise" decision.
- **LMS / XYZ** — research/simulation spaces (LMS is literally cone responses → used for CVD simulation; XYZ's Y = relative luminance, the WCAG basis).

---

## 8. Properties of color & 9. Color mixing

Hue / chroma / lightness (and tone/tint/shade/opacity/chromaticity) defined precisely; "lightness, brightness, value are _unique_ measurements" across spaces. Notable for us:

- **Opacity**: translucent colors "retain consistent WCAG relative-luminance contrast" across surfaces but "**do not have the same perceived contrast** between light and dark backgrounds." ← relevant to our deferred alpha-variant story.
- **Lower chroma is harder to distinguish for CVD** users.
- Digital = **additive** (sRGB); subtractive (RYB/CMYK) is a mental model from print, not displays. CSS `color-mix` can approximate either.

---

## 10. Color relationships / harmonies → map to palette _purposes_

Analogous, complementary, split-comp, triadic, tetradic, monochromatic, polygonal (Itten's "harmonious chords"). The useful mapping for us:

- **Monochromatic** → uniform UI scales.
- **Complementary** → diverging dataviz scales.
- **Triadic / tetradic / polygonal** → categorical / taxonomy / dataviz colors ("uniquely identifiable color… while ensuring balance and harmony").
- Recurring warning: **every multi-hue harmony "may be prone to color conflicts for CVD users"** → ties back to the ΔE-per-CVD check.
- "**Hue is treated differently between color spaces**" → which colors count as "complementary/analogous" depends on the space; okLCH hue is the perceptual one.

---

## 11. Device color modes (export/theme targets)

- **Light / dark** → `prefers-color-scheme`. Dark mode often wants **unique color values** (not just inverted) and **lower chroma** (Hunt effect).
- **Increase contrast (iOS)** → `prefers-contrast`; a distinct higher-contrast theme.
- **High contrast (Windows)** → `forced-colors`; **overrides** styling with a semantic keyword set (`ButtonFace/ButtonText/Canvas/CanvasText/Highlight/HighlightText/LinkText`). "**Do not create custom themes for it** — it's user-controlled; just map to the keywords."

---

## 12. UI & Data Visualization — the palette use-case taxonomy

The guide names the distinct **purposes** a palette serves, each with its own accessibility need (this is the frame the brief asked for):

| Scale type         | Represents                                           | Primary need                                                           |
| ------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------- |
| **UI color scale** | text / icons / interactive / states / decoration     | must contain steps meeting **WCAG 1.4.3**; perceptually-balanced steps |
| **Sequential**     | numeric low→high (quantitative)                      | perceptually-uniform progression                                       |
| **Diverging**      | numeric with neutral midpoint (polarity)             | balanced both sides; **CVD-conflict-prone**                            |
| **Categorical**    | unordered categories (qualitative)                   | maximally distinguishable; **CVD-conflict-prone**; never color-only    |
| **Color theme**    | a _collection_ of scales (light/dark/contrast/brand) | per-mode contrast                                                      |
| **Adaptive theme** | user-adjustable lightness / contrast / saturation    | personalization for varied sensitivity                                 |

Recurring across all: "**Do not rely on color choice alone** to make data viz accessible" (≈ WCAG 1.4.1) and "use a color appearance model for perceptually balanced scales" (≈ our okLCH).

---

## 13. Synthesis — what this means for our plugin

**What the guide _validates_ about our current direction:**

- okLCH (uniform/opponent space) for the model — explicitly "better for evaluating color and creating color scales."
- APCA **alongside** WCAG, with polarity awareness and a font-lookup table — the guide's exact contrast story.
- P3-when-allowed + gamut-mapping with sRGB fallback.
- Chart-based **manual per-channel (L/C/H) tuning on top of generation** — the antidote to the "uniform spaces are linear, perception is non-linear" caveat and to Abney/Helmholtz–Kohlrausch effects.

**The clearest net-new opportunity — CVD accessibility (the brief's focus):**

1. **ΔE2000 color-difference, evaluated under CVD simulation.** Simulate each palette color through **protan / deutan / tritan** (LMS-based), compute ΔE2000 between simulated pairs, and **flag pairs that fall below a JND-ish threshold** (the guide: "CVD-safe colors must pass a threshold of color difference for their simulated counterparts"). Pairs naturally with our existing contrast grid as a second "distinguishability" matrix.
2. **CVD preview filters** for the palette/grid (deutan/protan/tritan/mono) — useful, but pair with #1 and surface the guide's caveat that simulation alone over-promises safety.
3. **Default to deutan/protan** (the ~7–8% common cases); treat tritan/mono as secondary.

**Other informed feature ideas (lower priority):**

- A **palette-purpose mode** (UI / sequential / diverging / categorical) that adjusts what we check: UI → WCAG-step coverage; sequential/diverging → perceptual-uniformity of steps; categorical → max ΔE separation + CVD safety.
- **Multi-mode theme support** (light + dark + increase-contrast variants), with dark mode hinting _lower chroma_ and _independent_ contrast evaluation (not naïve inversion).
- A **"squint"/greyscale** grid view (luminance-only) to judge lightness apart from the Helmholtz–Kohlrausch illusion — and to approximate a monochromacy check.
- **Warn on chromostereopsis** (adjacent very-high-chroma red/blue) for text pairings.

**Framing for users:** WCAG 1.4.3 is the _compliance floor_; APCA is the _perceptual truth_; ΔE-under-CVD is the _distinguishability_ check; manual chart tuning is where _aesthetics_ live. A palette tool that surfaces all four — keyed to the palette's _purpose_ — is solving the real problem the guide describes.

---

_Source: colorandcontrast.com by Nate Baldwin (© 2026). Crawled live 2026-06-20. This doc paraphrases concepts for our internal design reasoning; see the site for the interactive demonstrations (many concepts are taught through interactive illusions that text can't capture)._
