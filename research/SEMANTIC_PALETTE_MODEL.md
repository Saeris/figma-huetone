# Semantic Palette Model — Ramp Roles & APCA-for-UI

> Study of two interlocking resources that extend contrast evaluation **beyond text** to the full set of UI roles a color ramp serves:
>
> - **[ServiceNow Horizon — Color contrast & APCA](https://horizon.servicenow.com/guidelines/accessibility/color-contrast)**: a shipped design-system spec assigning **APCA Lc minimums to every UI element type** (not just text).
> - **[Radix Colors — Understanding the scale](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)** + the **[custom palette tool](https://www.radix-ui.com/colors/custom)**: a 12-step scale where **each step is designed for a specific semantic UI role**.
>
> Studied live 2026-06-20. Together they answer a question Polychrom (text-only) doesn't: _as you slice a color ramp, which slice serves which UI role, and what contrast must each role meet?_ This is the missing half of palette accessibility for our tool.

---

## 1. Why this matters (vs. our current contrast work)

Polychrom, contrast.tools, and our Phase-5/6 features all evaluate **text legibility** (APCA Lc of foreground text vs. background). But a UI color ramp is mostly **not text** — it's backgrounds, component fills, borders, focus rings, solid accent fills, chart segments. Each has its _own_ contrast requirement and its _own_ reference (what it's measured against). Horizon defines those requirements; Radix defines which ramp step plays which role. A palette tool that knows both can validate a whole ramp _by role_, not just "is step 11 readable."

---

## 2. Radix — the 12-step semantic scale

Radix's core idea: a scale has **12 steps**, each designed for ≥1 specific use case. The custom tool generates all 12 from just **3 seed colors** (Accent + Gray + Background) and labels them in **5 groups**.

| Step | Use case                                            | Group                        |
| ---- | --------------------------------------------------- | ---------------------------- |
| 1    | App background                                      | **Backgrounds**              |
| 2    | Subtle background                                   | **Backgrounds**              |
| 3    | UI element background (normal)                      | **Interactive component bg** |
| 4    | Hovered UI element background                       |                              |
| 5    | Active / Selected UI element background             |                              |
| 6    | Subtle borders & separators (non-interactive)       | **Borders & separators**     |
| 7    | UI element border & focus rings                     |                              |
| 8    | Hovered UI element border (stronger)                |                              |
| 9    | Solid background (highest chroma — the "pure" step) | **Solid colors**             |
| 10   | Hovered solid background                            |                              |
| 11   | Low-contrast text                                   | **Accessible text**          |
| 12   | High-contrast text                                  |                              |

**Key rules baked in (these are the seams to APCA):**

- **"Steps 11 and 12 are guaranteed to Lc 60 and Lc 90 APCA contrast on top of a step-2 background from the same scale."** ← Radix's text steps are _defined by APCA targets_.
- **Step 9** is the highest-chroma step (least black/white mixed in) → solid fills, logos, accent borders. Most step-9 colors expect **white** foreground text; **Sky, Mint, Lime, Yellow, Amber** expect **dark** foreground (their luminance is too high for white).
- Steps 3/4/5 and 7/8 encode **interaction states** (normal / hover / pressed-or-active) — the ramp carries state, not just shade.
- Backgrounds (1–2) may map differently per light/dark mode via a mutable `AppBg` alias.

So a Radix ramp is **one hue across lightness**, sliced into roles. The custom tool then previews the scale in real mockups (cards, forms, buttons, sidebars) so you see each role in context.

---

## 3. Horizon — APCA Lc minimums for every UI element

Horizon applies APCA (explicitly "beyond WCAG 2.1") and breaks UI into **5 categories**, each with element _parts_ and a required **Lc** between specific pairs. The complete ladder:

### Text & icons (vs. canvas)

| Pair                                            | Min Lc    |
| ----------------------------------------------- | --------- |
| Regular text vs canvas                          | **Lc 60** |
| Large text (≥18pt, or ≥14pt bold/700) vs canvas | **Lc 45** |
| Informational icon vs canvas                    | **Lc 45** |

### Form fields

| Pair                                                                       | Min Lc               |
| -------------------------------------------------------------------------- | -------------------- |
| Field text vs field                                                        | Lc 60                |
| Readonly text vs field                                                     | Lc 60                |
| Placeholder text vs field                                                  | Lc 30                |
| Disabled text vs field                                                     | Lc 15                |
| **Field visibility** — _one of_: field↔border, canvas↔border, canvas↔field | Lc 30 (readonly: 15) |
| Focus ring vs canvas **or** focus ring vs field                            | Lc 30                |
| Default border vs error border                                             | Lc 30                |

### Buttons (face / contents / border / canvas)

| Pair                                                                              | Min Lc                       |
| --------------------------------------------------------------------------------- | ---------------------------- |
| Button text vs button face                                                        | Lc 60                        |
| Button icon vs button face                                                        | Lc 45                        |
| Disabled button content vs face                                                   | Lc 15                        |
| **Primary button visibility** — _one of_: face↔border, canvas↔border, face↔canvas | Lc 30                        |
| Secondary / tertiary button visibility (same triplet)                             | Lc 15                        |
| Bare buttons                                                                      | (only the text rule applies) |

### Containers

| Pair                                          | Min Lc |
| --------------------------------------------- | ------ |
| Card fill vs canvas **or** boundary vs canvas | Lc 15  |
| Highlighted value fill vs canvas              | Lc 15  |

### Data visualization

| Pair                    | Min Lc |
| ----------------------- | ------ |
| Chart segment vs canvas | Lc 45  |
| Chart line vs canvas    | Lc 45  |

**The Lc ladder, summarized:** **Lc 60** = readable body text / field text / button text · **Lc 45** = large text, icons, chart marks · **Lc 30** = "it's visibly _there_" (borders, focus rings, fills against canvas, placeholder) · **Lc 15** = barely-perceptible / disabled / decorative containers. (These align with the APCA tiers our `fontLookup.ts` `contrastTier` already encodes: 90/75/60/45/30/15.)

---

## 4. How the two interlock

Radix says _which step is a border / fill / text_; Horizon says _what Lc that role needs and against what_. They agree at the seam (Radix text = Lc 60/90; Horizon regular text = Lc 60). Composed:

```
Ramp step (Radix role)            →  Contrast check (Horizon Lc, vs. reference)
1–2  App / subtle background      →  (the reference surface; others measured against it)
3–5  Component bg (states)        →  fill vs canvas ≥ Lc 15–30 (visibility)
6–8  Borders / focus rings        →  border vs canvas/fill ≥ Lc 30 (interactive), 15 (subtle)
9–10 Solid accent fill            →  fill vs canvas ≥ Lc 30; + its FG text (white/dark) vs fill ≥ Lc 60
11   Low-contrast text            →  vs bg ≥ Lc 60
12   High-contrast text           →  vs bg ≥ Lc 90
```

This is a **per-role contrast spec for an entire ramp** — far richer than a single text readout.

---

## 5. Implications for our tool

1. **Add a "semantic ramp" lens.** Let the user label (or auto-suggest) which steps of a ramp play which role (Radix's 12-role model is a sensible default template), then **validate each role against the right Horizon Lc threshold and the right reference** (text→bg, border→canvas, fill→canvas, solid-fill→its FG). Output: a per-role pass/fail with the actual Lc — the contrast equivalent of a linter for the ramp.
2. **Generalize our contrast checks beyond text.** Our APCA/`fontLookup` work is text-centric; the Lc-30/15 tiers for borders/fills/focus-rings/containers are a small extension of the same `contrastTier` we already have. The thresholds are just a role→Lc table (§3).
3. **Solid-step foreground rule.** For step-9-style solid fills, auto-decide white vs. dark foreground by APCA (Radix's Sky/Mint/Lime/Yellow/Amber exception emerges naturally from measuring both polarities — pick the one ≥ Lc 60). We already compute both polarities.
4. **Generate-from-few-seeds, preview-in-context.** Radix's "3 seeds → 12-step labeled scale → live UI mockup" is a strong UX model. Our chart-based editor produces the ramp; a **role-labeled preview** (text/border/fill/solid mockups, like Radix's) would make the semantic structure legible and let users _see_ each role meet contrast.
5. **Pairs with the CVD work, not replaces it.** This model is about **one ramp's vertical roles** (lightness axis); the [Harmony CVD evaluation](./HARMONY_CVD_EVALUATION.md) is about **distinguishability across hues** (the horizontal axis). A complete tool checks both: _down_ a ramp (role contrast, Horizon/Radix) and _across_ hues (CVD ΔE). Notably, the CVD finding (don't equalize luminance across categorical hues) and this model (a ramp _should_ have monotone luminance steps) are consistent once you separate "ramp" from "categorical set."

---

## 6. Source notes

- Horizon: `horizon.servicenow.com/guidelines/accessibility/color-contrast` — a shipped, production design-system guideline; APCA-based themes alongside WCAG-2.1 themes. All Lc values quoted verbatim from the page.
- Radix: `radix-ui.com/colors/docs/palette-composition/understanding-the-scale` (the 12-step role table + caveats) and `radix-ui.com/colors/custom` (the 3-seed generator with the 5 group labels: Backgrounds / Interactive components / Borders and separators / Solid colors / Accessible text).
