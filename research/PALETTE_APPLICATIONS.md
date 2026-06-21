# Palette Applications — Theme Structure, Elevation & Data Visualization

> The thread running through all our research: **a color palette isn't applied generically — it's applied for specific purposes, and each purpose has its own rules.** This doc covers three application contexts that our tool should treat distinctly: (1) the **narrowed theme structure** a real design system actually uses, (2) **elevation / background surfaces** (Fluent + Atlassian), and (3) **data visualization** (Adobe Spectrum + IBM Carbon). Studied 2026-06-21. Builds on [COLOR_AND_CONTRAST_RESEARCH.md](./COLOR_AND_CONTRAST_RESEARCH.md) §12 (use-case taxonomy) and [SEMANTIC_PALETTE_MODEL.md](./SEMANTIC_PALETTE_MODEL.md).

---

## 1. Theme structure — what a design system actually uses (from `@saeris/ui`)

The full `@saeris/colors` palette is 25 hues × 12 steps × light/dark — but the **applied theme** (inspected via Figma Variables in the `@saeris/ui` file) narrows this hard to the sets that define a UI:

- **Primary (brand)** — `Primary/25…700`, which is an **alias of a single hue** (`Primary/500` = `Violet/500` = `#979cfe`). The brand color is _one ramp_, referenced semantically.
- **Neutral** — a full ramp `Neutral/50…950` **plus alpha variants** `Neutral/alpha/200…900` (for overlays/dividers that adapt to whatever's behind them).
- **Semantic** — small, meaning-bearing sets: `Info`, `Callout` (a warning/amber: `Callout/bg #ffc10046`, `border`, `icon`, `summary`, `description`). Each semantic color is a _cluster of sub-role tokens_, not a single value.
- **Surface / elevation** — `bg #111111`, `surface/solid #303030`, `surface/3 #afbdff2e` (an **alpha-tinted** surface). See §2.
- **Component-semantic tokens (Radix-like, state-aware)** — `styles/button/initial/{fill,stroke,text}`, `input/{fill,stroke,text,icon,:focus/fill,:focus/stroke,inner-focus-ring}`. The ramp is mapped to _roles × states_, exactly the [Radix/Horizon model](./SEMANTIC_PALETTE_MODEL.md).

**Takeaway for the tool:** the unit a designer themes with is **Primary + Neutral + Semantic (+ surfaces)** — a handful of ramps and small semantic sets — _not_ the 25-hue mega-palette. This is why the [CVD 17-hue sweep](./SAERIS_COLORS_CVD_EVALUATION.md) is a worst-case stress test rather than the real usage: in practice the categorical burden is small (a few semantic colors), which is the set that actually needs pairwise CVD checking (red↔green danger↔success).

---

## 2. Elevation — the background-reference problem

The user's key insight: **elevation determines which background you compare contrast against**, and elevation surfaces must be far more _subtle_ than a normal ramp — under-documented territory. Two systems answer it from opposite directions.

### Fluent 2 — elevation as **shadow**, computed from luminosity

- Elevation = perceived z-distance via **shadows** (key shadow for edges + ambient shadow for distance). A **shadow ramp keyed to blur**: shadow 2 (2px) → shadow 64 (64px). Low ramp (2/4/8/16), high ramp (28/64).
- **Dark mode uses higher shadow opacity** (14% → 28%) — shadows are weaker on dark, so they're strengthened.
- **Windows variant uses strokes instead of key shadows** to outline elevated objects (borders, not shadows).
- **Shadows on colored surfaces** are corrected by a **luminosity equation** (so the _same_ elevation reads consistently across surface colors):
  - `Luminosity = 0.2126·R + 0.7152·G + 0.0722·B` ← the WCAG relative-luminance formula.
  - `Shadow1 opacity = Round(42 − 0.116 · luminosity)`; `Shadow2 opacity = Round(34 − 0.09 · luminosity)`.
  - Rule: _"Don't use the main shadow ramp on colored surfaces"_ — recompute opacity from luminance.

So in Fluent, the **surface color barely changes** between elevations (the depth cue is shadow), and the contrast reference stays ≈ the base surface.

### Atlassian — elevation as **surface color** (esp. in dark mode)

- **Four named levels: Sunken / Default / Raised / Overlay** (+ Overflow for scroll shadows). A _semantic_ ladder, not a numeric scale.
- Surfaces + shadows together; only the top two (Raised, Overlay) add shadows. Lower levels differ by **surface color, border, or whitespace**.
- **The dark-mode crux:** _"Shadows can be harder to see in dark mode, so dark mode elevations rely on different surface colors — the higher the elevation, the lighter the surface."_ In light mode elevation ≈ shadow; in dark mode elevation ≈ **progressively lighter surfaces** (because shadows vanish on black).
- **Opaque vs. transparent surface tokens** (mirrors `@saeris/ui`'s alpha surfaces):
  - `elevation.surface.sunken` — **opaque**, darkens in both modes.
  - `color.background.neutral` — **transparent**, darkens in light / _lightens_ in dark — _"use when the background needs to adapt to different elevations"_ (relevant in dark mode).
- Interaction states (hover/pressed) are **surface-color changes** too.

### Synthesis — what elevation means for our tool

- **Elevation is a distinct, low-contrast surface ramp.** Each level is the **background reference** for the content placed on it — so contrast for that content must be measured against the _right elevation surface_, not a single page background. Our contrast checks should let the user pick the elevation level as the bg reference.
- **Elevation steps are _subtle_ — ΔL of a few percent**, far smaller than a UI ramp's 8–12% steps. A tool could offer an "elevation ramp" mode with much tighter step deltas and verify each level is _just_ distinguishable from its neighbor (the inverse of maximizing contrast).
- **Light vs dark invert the mechanism:** light mode leans on shadow (surface ≈ constant → reference stable); dark mode leans on lighter surfaces (reference _changes per level_). A dark theme genuinely needs a surface ramp; a light theme may not.
- **Alpha surfaces ⇒ composite before measuring.** Both `@saeris/ui`'s `surface/3` (#afbdff2e) and Atlassian's transparent `background.neutral` mean the _effective_ background is the composite over whatever's behind it. Contrast must be computed on the **composited** color — the opacity-compositing capability flagged in the [Polychrom study](./POLYCHROM_RESEARCH.md), now central rather than incidental.
- **Shadow opacity from luminance (Fluent's equation) is a nice generated-token idea** if we ever emit elevation tokens.

---

## 3. Data visualization — a different discipline from UI color

UI color is about _semantic roles + contrast_; data-viz color is about _encoding data values into perceivable, ordered-or-unordered, CVD-safe color_. The authoritative systems agree on a three-type model and add hard, specific rules.

### The three palette types (Adobe Spectrum + IBM Carbon, and the [color-&-contrast guide](./COLOR_AND_CONTRAST_RESEARCH.md) §12 agree)

| Type                          | Data                 | Construction                                               | Rule                                                 |
| ----------------------------- | -------------------- | ---------------------------------------------------------- | ---------------------------------------------------- |
| **Categorical** (qualitative) | unordered categories | maximally-distinct hues                                    | **cap at ~6**; CVD-optimized; never for ordered data |
| **Sequential** (quantitative) | ordered low→high     | one hue, light→dark (or multi-hue perceptual like Viridis) | darker = larger; never for categories                |
| **Diverging**                 | ordered ± a midpoint | two sequential ramps meeting at a neutral center           | crop (don't distort) to fit asymmetric ranges        |

### Spectrum's specifics

- **Categorical 6-color palette "optimized to be distinguishable for users with CVD."** Hard guidance: _"Use up to 6 categorical colors. Difficult at 6, extremely difficult at 12. Beyond that, use position/shape encoding instead."_
- Named sequential palettes: **Viridis, Magma, Rose, Cerulean, Forest** (Viridis = the perceptually-uniform, CVD-safe, greyscale-safe gold standard). Diverging: Orange-yellow-seafoam, Red-yellow-blue, Red-blue.
- _"Darker colors = larger numbers"_ (luminance carries magnitude). _"Be consistent with color across charts."_ _"Don't rely on color alone — encode with position too."_

### Carbon's specifics (more codified)

- **Categorical sequence is hand-ordered to maximize neighbor contrast**: Purple70 → Cyan50 → Teal70 → Magenta70 → Red50 → … — note the deliberate **luminance bounce** between consecutive colors (70/50/70/70/50). The _opposite_ of equalizing luminance.
- **Per-N override palettes** when category count is known (pick the most-distinct subset).
- **Sequential = monochromatic** ramps (Blue/Purple/Cyan/Teal 10–100); "darkest = largest (light theme), lightest = largest (dark theme)."
- **Diverging** = Red↔Cyan (hot/cold) and Purple↔Teal (neutral); _"do not differentiate light/dark theme."_
- A separate **Alert palette** (Red/Orange/Yellow/Green = danger/serious-warning/warning/success) — distinct from both categorical and UI-semantic; a 4th named purpose.

### Other authoritative sources worth citing

- **Viridis / ColorBrewer** (Cynthia Brewer) — the research foundation for sequential/diverging/categorical map palettes; Viridis (matplotlib) is the canonical perceptually-uniform + CVD-safe + greyscale-safe sequential ramp.
- **Tableau 10 / 20** — the widely-used categorical reference (deliberately luminance-and-hue-varied for distinguishability).
- **Lyft "Re-thinking color"** / **Stripe**, and **viz-palette / Colorgorical / Leonardo** (Adobe) as generators that optimize categorical distance.

### Synthesis — data-viz mode for our tool

- **A categorical-palette mode is the clearest data-viz feature**, and it's the _direct application of our CVD ΔE work_: generate/curate ≤6 colors, **maximize minimum pairwise ΔE — including under CVD simulation** (Spectrum/Carbon both do this manually; we can do it measured). Carbon's "alternate luminance between neighbors" is the concrete tactic — and it's exactly the [fix the Harmony/@saeris CVD analysis points to](./SAERIS_COLORS_CVD_EVALUATION.md).
- **Sequential mode** = our existing ramp generation, but judged by _perceptual uniformity of steps_ (ΔE between consecutive ~equal) and **greyscale-safety** (monotone luminance) rather than role-contrast. Viridis-style multi-hue ramps are a target.
- **Diverging mode** = two sequential ramps + neutral midpoint, with "crop don't distort."
- **The dividing line is the key product idea:** the tool should know whether the user is building **UI semantic** colors (→ role-contrast checks, Horizon Lc ladder), an **elevation ramp** (→ subtle low-contrast surface steps, composite-aware), a **categorical** set (→ maximize CVD-safe ΔE, cap ~6), or a **sequential/diverging** scale (→ perceptual-uniformity + greyscale-safety). Same color engine, different lens and different "is this good?" verdict per purpose.

---

## 4. The unifying model for the tool

Every research thread now converges on one idea: **palette purpose selects the evaluation.**

| Purpose                              | Primary check                                                | Reference                       | Key source        |
| ------------------------------------ | ------------------------------------------------------------ | ------------------------------- | ----------------- |
| UI semantic (text/border/fill/state) | APCA Lc per role                                             | the role's bg (incl. elevation) | Horizon, Radix    |
| Elevation surfaces                   | _minimal_ distinguishability between levels; composite alpha | the level below                 | Fluent, Atlassian |
| Categorical (status, series)         | maximize pairwise ΔE **under CVD**; ≤6                       | each other                      | Spectrum, Carbon  |
| Sequential                           | perceptual-uniform steps + greyscale-safe                    | adjacent steps                  | Viridis, Carbon   |
| Diverging                            | balanced ± midpoint, crop-not-distort                        | center                          | Spectrum, Carbon  |

Two orthogonal axes underlie all of it — **down a ramp** (lightness/role/elevation) and **across hues** (categorical distinguishability/CVD) — and the tool's unique opportunity is to surface the _right_ check for the _declared_ purpose, instead of a one-size-fits-all contrast number.
