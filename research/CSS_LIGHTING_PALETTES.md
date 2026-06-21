# Lighting-Model Color Palettes in Pure CSS

> An exploration: can we generate **accessible, characterful color palettes by simulating light** — a key light, sky fill, and bounce hitting a single diffuse "albedo" color — entirely in modern CSS? And expose that as intuitive knobs (key-light color, time of day, environment) that re-theme a whole UI? **Yes — verified hands-on in a real browser.** A working prototype lives at [`prototypes/lighting-palette.html`](./prototypes/lighting-palette.html). 2026-06-21.

This is the creative counterpart to the analytical research: where [COLOR_AND_CONTRAST_RESEARCH](./COLOR_AND_CONTRAST_RESEARCH.md) and [PALETTE_APPLICATIONS](./PALETTE_APPLICATIONS.md) tell us _what makes a palette good_, this asks _what makes one feel alive_ — and whether the plugin can offer "lighting" as a generative model instead of mechanical lightness ramps.

---

## 1. The motivating idea

A flat, monochromatic ramp (constant hue, evenly-stepped lightness) is what a naïve generator produces — and it looks subtly _wrong_. Real surfaces don't darken by simply losing lightness:

- **The lit side and the shadow side are lit by different light.** In daylight: warm sun on the lit facets, cool blue skylight in the shadows, plus **warm bounce** from the ground. ([James Gurney, _Color and Light_](https://jamesgurney.com/products/color-and-light-a-guide-for-the-realist-painter-signed-by-james-gurney): "warm light, cool shadow"; shadows have _multiple_ colored light sources, so they're never neutral black.)
- So a real surface's ramp **shifts hue as it darkens** — the dark end is dominated by sky + bounce, not the surface's own hue. This is "color gradation": hue, chroma, and lightness all move together.

That hue-shift is exactly what Huetone makes you dial in **by hand** (per-tone H). The thesis here: **derive it automatically from a small, physically-motivated lighting model**, and let the user steer the _light_ rather than each swatch.

The user's framing: take one diffuse sphere color, light it (key light color, global illumination / time of day à la [Daylight Computer](https://daylightcomputer.com/)'s amber-circadian display, adjacent-surface bounce), and **sample the result into a ramp**. Even a fraction of a real shading pipeline, expressed in CSS, gives expressive "knobs" over a whole palette's feel.

---

## 2. What modern CSS can actually do (all verified in-browser)

Tested live in Chromium — every capability below returned `true` from `CSS.supports()` and produced correct computed values:

| Capability                                                              | Status | Why it matters here                                      |
| ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| **Relative color syntax** `oklch(from C l c h)`                         | ✅     | destructure an origin color into `l c h` channels        |
| **`calc()` on any channel** `oklch(from C calc(l + .2) c calc(h + 30))` | ✅     | the lighting math (lighten facet, shift hue)             |
| **Nested RCS**                                                          | ✅     | chain transforms (shade → tint → bounce)                 |
| **RCS inside `color-mix`**                                              | ✅     | "mix the shaded color _toward_ the key-light hue"        |
| **`color-mix(in oklch, …)`**                                            | ✅     | additive colored-light contributions, in a uniform space |
| **`@property` typed custom props**                                      | ✅     | knobs as `<number>`/`<angle>`/`<color>`                  |
| **Transitions on typed custom props**                                   | ✅     | **animate the whole palette** (time-of-day)              |
| **Trig in `calc()`** (`sin`/`cos`)                                      | ✅     | angular light falloff if desired                         |

The crucial one: **`oklch`/`oklab`/`lch`/`lab` relative colors keep their output in that space** (no premature sRGB clamping), so the lighting math happens in a perceptually-uniform space and lightness stays even.

---

## 3. The technique (the working model)

Treat each ramp step as a **surface facet** with a "how lit" value `--lit` ∈ [0,1] (1 = facing the key light → brightest; 0 = deep shadow). For an albedo color, each step is:

```css
/* 1) shade: push lightness by how lit the facet is, re-centered on 0.5 */
--shaded: oklch(
  from var(--albedo)
    clamp(
      0.05,
      calc((l - 0.5) * var(--contrast) + 0.5 + (var(--lit) - 0.5) * 0.6),
      0.985
    )
    c h
);

/* 2) colored light: lit → key-light hue; shadow → sky hue; pit → warm bounce */
--k: color-mix(
  in oklch,
  var(--shaded),
  oklch(0.82 0.13 var(--keylight-hue))
    calc(var(--keylight-strength) * var(--lit) * 100%)
);
--s: color-mix(
  in oklch,
  var(--k),
  oklch(0.55 0.12 var(--sky-hue))
    calc(var(--sky-strength) * (1 - var(--lit)) * 100%)
);
--f: color-mix(
  in oklch,
  var(--s),
  oklch(0.45 0.11 var(--bounce-hue))
    calc(var(--bounce-strength) * pow(1 - var(--lit), 2) * 100%)
);
background: var(--f);
```

Driven by `@property`-typed knobs: `--albedo`, `--keylight-hue/-strength`, `--sky-hue/-strength`, `--bounce-hue/-strength`, `--ambient`, `--contrast`.

### What it produces (measured from the prototype)

Albedo `oklch(0.62 0.15 264)` (a blue), default "midday" knobs → a 12-step ramp whose computed values are:

```
 25  oklch(0.916 0.16 231.8)   ← lit end, hue pulled WARM (toward cyan/key)
500  oklch(0.595 0.156 254.4)
950  oklch(0.380 0.153 273.9)  ← shadow end, hue pulled COOL (toward sky)
```

**Lightness descends smoothly (0.92 → 0.38) while hue sweeps 42° (232° → 274°)** — a real "warm light, cool shadow" gradation, generated, not hand-tuned. A monochromatic ramp would hold 264° flat the whole way.

### It re-themes the whole UI by changing the "light"

- **Midday** (warm key 85, cool sky 240): cyan-lit → indigo-shadow, lively.
- **Dusk / "Daylight-style"** (amber key 45, strong sky 265): the entire arc rotates warm — lavender-pink lit end → violet shadows, same albedo.
- **Overcast** (weak key, neutral sky, no bounce): a flat, duller blue — the honest control showing what the lighting model _adds_.
- **Moonlight** (cool key, strong cool fill): desaturated, cold.

### It animates — the day-cycle, in pure CSS

Because the knobs are `@property`-typed, a single `transition: --keylight-hue 700ms` makes the **entire palette interpolate** when the light changes. Verified: transitioning `--keylight-hue` 85→30 drove a lit swatch's computed hue continuously through intermediate values (231.8° → 291.6° mid → 286.7°). No JavaScript in the render path — the sliders only set custom properties; the browser does all the color math. **That is the Daylight Computer time-of-day effect as one animatable property.**

---

## 3b. From one ramp to a lit UI _environment_ (the realistic version)

A single tinted ramp isn't how a UI is built. The prototype was extended to a small but complete **environment** — the structure a real design system uses (cf. the [Radix custom-color tool](./SEMANTIC_PALETTE_MODEL.md) and [PALETTE_APPLICATIONS](./PALETTE_APPLICATIONS.md) §1). All of this is still pure-CSS color math.

**Inputs the user controls:** a **brand** albedo, a **neutral** albedo, a **surface** color (the environment), a target page background — plus the light (key/sky/bounce/angle, as a "time of day").

**What's generated and how the pieces play off each other:**

1. **Brand + neutral ramps, lit by the same environment.** Both run through the same `--lit()` function, so they share one light and read as belonging together. The neutral picks up a faint cast of the brand/surface hue rather than being dead grey.
2. **Surface reflection (the key interplay).** Every step mixes in a little of the **surface** color (`--surf-reflect`) — the environment reflecting back onto the objects sitting on it. This is what makes the brand and neutral feel _placed on_ the surface rather than floating. Shadows, conversely, blend _onto_ the surface (tinted by it). Light goes both ways, as the user described.
3. **Ordered light→dark, but Lc-targeted.** The ramp must stay monotonic in lightness _and_ hit per-role APCA-Lc targets. The resolution: the **Lc-targeted steps are anchors** (Lc15/30/45/60/75/90 are naturally monotone darker on a light bg), and the structural steps **interpolate between anchors**. Verified output (brand ramp): L 0.98→0.35 strictly decreasing, with 400→Lc16, 500→Lc30, 600→Lc45, 700→Lc60, 950→Lc90. So _ordering and contrast targets hold simultaneously._
4. **Natural "lit" borders** (the [Steve Schoger](https://x.com/steveschoger/status/1695139153753604384) technique; cf. the "frosted/saturated borders" demos). A flat grey border looks dead because real edges **catch light on top and fall into shadow on the bottom**. So the border is a `border-image: linear-gradient(...)` from `--lit(neutral, L+Δ, lit)` at the top edge to `--lit(neutral, L−Δ, shadow)` at the bottom — sharing the surface hue, never grey, with the gradient angle following `--key-angle`. It's the _same light_ that makes the shadow, applied to the element's own edge.
5. **A sample UI** (page → surface → raised cards → brand buttons, with borders, fields, shadows) built **only from these generated tokens**, where the high/low-contrast text meets its APCA targets against the raised surface.

The payoff: switching the **time-of-day preset re-lights the entire environment coherently** — brand, neutral, surfaces, borders, and shadows all shift together (midday cyan/blue → dusk violet/warm-grey), in pure CSS, while text legibility is preserved.

### CSS `@function` makes the model reusable

The lighting model is factored into a **CSS `@function --lit(--albedo, --L, --t)`** reused by every ramp swatch _and_ every semantic token — verified working in current Chromium. This is bleeding-edge (CSS Functions, 2025+), so it's a progressive enhancement: the plugin can emit either the `@function` form or the inlined `color-mix` chain.

### Architecture note: how "pure CSS" it really is

The knobs live on **`data-*` attributes** read via **typed `attr()`** (`attr(data-key-h type(<number>))`) — verified to flow into `calc()`, color functions, and custom properties. So the _entire color computation is CSS_. JS does only two things, neither in the color render path: (a) one generic line mirrors a slider's live value to its data-attribute (a live `<input type=range>` value is a DOM _property_, not an attribute, so CSS can't read it directly — this is the one unavoidable bridge), and (b) the **"Lc pass"** computes each role's _target lightness_ (APCA can't run in CSS) and writes it as a data-attr. Drive the data-attrs by hand (e.g. `data-key-h="42"`) and it works with zero JS.

Several more modern-CSS features the prototype uses, all verified in current Chromium:

- **`contrast-color()`** picks black/white foreground from a background in _pure CSS_ — used on every **swatch label** (`color: contrast-color(var(--c))`, so labels stay legible as the ramp darkens) _and_ the brand button (`color: contrast-color(var(--solid))`). This is the dark-on-light / light-on-dark decision (Radix's step-9 rule) done natively, no JS. Note it works through a `var()` that resolves to a `color-mix`/`@function` chain. (The older `color-contrast()` is **not** supported here — use `contrast-color()`.)
- **Pure-CSS light/dark toggle.** A visually-hidden checkbox flips the theme via `body:has(#mode:checked){ color-scheme: dark }`, and `light-dark(…, …)` supplies the page chrome's two-valued colors. The `:has()` + `light-dark()` combo is a genuinely JS-free theme switch.
- **`<input type=color>` pickers** for the brand / neutral / surface diffuse colors. The only JS is a small hex→oklch conversion that writes the L/C/H to data-attrs (same category as the slider bridge).
- **Light direction is real trig.** The shadow offset (and border gradient) derive from `--key-angle` via `sin`/`cos`. Gotcha worth recording: CSS's y-axis points _down_, so for a light bearing clockwise-from-top, the shadow offset is `(-sin θ, cos θ)` and the conventional "light from upper-left" is **θ ≈ 315°** (shadows toward lower-right). Wrong sign lights the UI from below — subtly _off_ even when you can't name why.

### A real limitation: `light-dark()` ✗ relative color syntax

`oklch(from var(--x) …)` **cannot destructure a `light-dark()` origin** — if `--x` is `light-dark(a, b)`, the relative color returns _transparent_ (and poisons any `@function`/`color-mix` that consumes it). So the surface lightness that feeds the generative `oklch(from --surface …)` math must be a **plain number** (set by the toggle's JS), and `light-dark()` is reserved for the _page chrome_ only. A clean, real composition gap between two new features — worth knowing before relying on it.

---

## 4. Realistic shadows fall out of the same model

The research on shadow realism ([Josh Comeau](https://www.joshwcomeau.com/css/designing-shadows/), Tobias Ahlin, and Fluent's key+ambient model from [PALETTE_APPLICATIONS](./PALETTE_APPLICATIONS.md)) says two things, both expressible here:

1. **Layer shadows** (3–5 stacked, increasing offset+blur, _decreasing_ opacity) to approximate penumbra falloff — a single shadow looks flat.
2. **Tint the shadow** — never grey/black. It should be a darkened, saturated version of the surface/background hue, pushed toward the **sky/fill** hue.

In the prototype the shadow is literally derived from the same albedo + sky knob:

```css
--shadow: color-mix(
  in oklch,
  oklch(from var(--albedo) 0.25 calc(c * 1.1) h),
  oklch(0.3 0.1 var(--sky-hue)) 45%
);
box-shadow:
  0 0.5px 0.7px /*…*/,
  0 19px 28px color-mix(in oklch, var(--shadow), transparent 91%); /* 5 layers */
```

So the **same `--sky-hue` knob** that cools the ramp's shadows also tints the cast shadows — one coherent "environment."

---

## 5. Limits & honesty

- **It's a _stylized_ lighting model, not a renderer.** No real geometry, occlusion, or spectral physics — just a weighted sum of colored contributions keyed to a `--lit` value per step. That's enough to _feel_ right (the human eye reads the warm/cool gradation), which is the goal.
- **Accessibility is not automatic.** A lighting-derived ramp still needs the contrast/CVD checks from the rest of our research — the lighting model controls _feel_, not WCAG/APCA Lc. But it's _compatible_: because everything is oklch, we can clamp/verify L per step. A good integration would generate the lit ramp **then** snap each step to its required APCA-Lc target (lighting sets hue/chroma character; contrast targets set lightness).
- **`--lit` per step is authored, not computed from geometry.** A fuller version could compute `--lit` from a notional surface-normal vs. light-direction (`cos` of the angle) — trig is supported — but a hand-placed curve is simpler and gives the designer direct control over the ramp shape.
- **Gamut:** mixing toward saturated light hues can push out of sRGB; the prototype stays modest, and `color-mix`/RCS results can be gamut-mapped (oklch → in-gamut) as we already do.
- **`@function` and typed `attr()` are very new** (CSS Functions + CSS Values 5, 2025). They work in current Chromium but aren't Baseline yet; treat the pure-CSS form as a progressive enhancement and have the plugin emit inlined/resolved fallbacks.
- **The surface-reflection / border / shadow tints are stylized, not measured GI.** They read as coherent because they all derive from the same few light values — which is the point — but they're an artistic approximation, not a light-transport solve.

---

## 6. What this means for our tool

This is a genuinely novel generative mode the plugin could offer — and it's _on-brand_ (okLCH-native, contrast-aware, Figma-Variable-friendly):

1. **A "Lighting" environment-generation mode.** The user picks a **brand** + **neutral** albedo and a **surface** color, then steers the **light** (key/sky/bounce, and a "time of day" master knob co-driving key warmth + sky strength along a sunrise→noon→dusk→night arc). The tool generates ordered, Lc-targeted **brand + neutral ramps that play off the surface** (surface reflection in, shadows blended out). Each ramp's hue-shift/chroma curve emerges from the model — automating the per-tone hue-tuning Huetone/our charts need by hand (and the Abney/Bezold-Brücke "shift hue as you lighten" guidance from the [color-&-contrast guide](./COLOR_AND_CONTRAST_RESEARCH.md)).
2. **Environment knobs that re-theme the whole multi-ramp system at once.** One `--time-of-day` shared across brand + neutral + surface gives a coherent "world" — change the light and the entire system (ramps, surfaces, borders, shadows) shifts together. This is a _system-level_ control no current palette tool offers, and it directly serves the multi-ramp structure real design systems use ([PALETTE_APPLICATIONS](./PALETTE_APPLICATIONS.md) §1, Radix custom-color).
3. **Coherent elevation, shadows, _and borders_ from the same light.** The light that shapes the ramps also generates **tinted layered shadows** (blended onto the surface, direction from the key angle, intensity ∝ elevation — Fluent), **elevation surface tints**, and **natural lit borders** (top-lit/bottom-shadow, surface-hued — Schoger). One model answers the elevation/background-reference questions from [PALETTE_APPLICATIONS](./PALETTE_APPLICATIONS.md) §2 _and_ the "realistic UI" border/shadow problem at once.
4. **Lc-anchored ramp sampling.** The "anchor at the Lc-targeted steps, interpolate the structural steps" method (prototype-proven) is exactly how the tool should reconcile _lighting feel_ with _contrast correctness_: lighting sets hue/chroma + the overall curve, APCA-Lc role targets pin the lightness of the contrast-critical steps, ordering is guaranteed. This is the concrete integration of [SEMANTIC_PALETTE_MODEL](./SEMANTIC_PALETTE_MODEL.md)'s role ladder with generation.
5. **Export is live CSS _or_ static tokens.** Because it's RCS + `color-mix` + `@property` (+ optional `@function`), the plugin can **emit the lighting model as parametric CSS** so the _shipped_ palette keeps the time-of-day knob (the Daylight effect, for free), **or** sample it at a chosen "time" to static oklch/Figma-Variable tokens for consumers without modern-CSS support.
6. **Layer the accessibility checks on top.** Generate-by-light, then verify/clamp by contrast + CVD. Lighting handles aesthetics (the gap every "uniform" palette has — see [HARMONY_CVD_EVALUATION](./HARMONY_CVD_EVALUATION.md)); our existing checks handle correctness. They compose cleanly because both live in oklch — the prototype already does the APCA-Lc clamp.

### Caveat on browser support / portability

RCS, `color-mix`, and `@property` are **Baseline 2024-ish** (all current evergreen browsers; not old Safari/Firefox ESR). For the _plugin's_ generation we don't depend on the user's browser — we can compute the model in JS (colorjs.io) and emit either parametric RCS **or** resolved static tokens. The pure-CSS form is the _optional_ export for teams who want the live, animatable version.

---

_Prototype: [`prototypes/lighting-palette.html`](./prototypes/lighting-palette.html) — open it (served over http, not file://) and try the presets/sliders. All color math is CSS; the script only sets custom properties._
