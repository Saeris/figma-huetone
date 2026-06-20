# Polychrom UI Research

> Hands-on study of Evil Martians' [Polychrom](https://github.com/evilmartians/figma-polychrom) Figma plugin — the reference for our Phase 5 selection-contrast feature (SPEC §2.3). Conducted 2026-06-20 by **running the live plugin** in Figma (on the Primer Web Community file's Button matrix) with Playwright, sampling real selections, **and** confirming details from the source (commit `5e275a0`).

This documents what Polychrom shows, how its verdict scale works, and what it does that we should match — distilled into a gap note against our own selection-contrast readout.

---

## 1. What Polychrom is

A single-purpose plugin: **select a layer (or two), and it shows the APCA contrast of the selection against its background**, with a font-size recommendation and the colors in OKLCH/RGB/HEX. From its README:

> - Displays the contrast level according to the APCA method.
> - Offers text size recommendations for regular (weight 400) and bold (weight 700) font styles, following the APCA contrast-to-font table.
> - Converts original colors to the OKLCH color model… RGB and HEX formats are also available.

It auto-detects the foreground/background pair by geometry (you can also explicitly select two nodes). The whole plugin is a small floating window (~328×260).

---

## 2. The panel anatomy (observed live)

When a node with a resolvable solid fill is selected, the window shows:

1. **A verdict label** (top-left), color-coded — e.g. "Body Text" (green), "Large Text" (neutral), "Not Readable" (red), "Invisible".
2. **The APCA Lc value** as a large 7-segment-style number, colored by pass/fail.
3. **Two font-size recommendations** (top-right) — e.g. `🅰 18px` / `🄰 14px` — the minimum legible sizes for **weight 400** and **weight 700** (from `fontLookupAPCA`).
4. **An "Aa" preview chip** rendered in the actual fg/bg pair, so you _see_ the legibility.
5. **A range bar** (0 → ~106/108, the Lc scale) with the marker at the current value.
6. **Two color readouts** at the bottom — the **foreground** and **background** colors, in the active format (OKLCH / RGB / HEX), each with an opacity %.
7. **A `?` help link** (→ APCA docs) and a **⚙ gear** that cycles the color format.

Empty state: a UFO illustration + **"Select a layer with a solid fill"** — shown when the selection has no resolvable solid fill (e.g. a component-set frame, or empty canvas).

---

## 3. Live readings — the full verdict spectrum

Sampled on the Primer Button matrix (each a real selection; values read off the panel):

| Selection                         | Lc     | Verdict          | fg → bg                                             | Notes                                                          |
| --------------------------------- | ------ | ---------------- | --------------------------------------------------- | -------------------------------------------------------------- |
| Green **primary button text**     | **76** | **Body Text** ✓  | white `100% 0 0` → green `55% 0.15 148` (OKLCH)     | white "Button" text over the green fill; recs 18/14px          |
| Grey **secondary button text**    | **58** | **Large Text**   | grey `139 139 152` → near-white `246 246 250` (RGB) | mid-range; recs 26/17px (larger, since lower contrast)         |
| Disabled **green button shape**   | **29** | **Not Readable** | muted green `82% 0.1 151` → white `100% 0 0`        | the disabled button fill vs. the page — intentionally low      |
| Disabled **red button text**      | **18** | **Not Readable** | pale red `89% 0.04 14` → white `99% 0 0`            | desaturated disabled-state red label — illegible               |
| Danger **rest variant** (bg only) | **~0** | **Invisible**    | (20%-opacity fill)                                  | the `rest` danger bg is 20% opacity → ~zero effective contrast |

**Key observations from driving it:**

- **Selecting just the text node works** — Polychrom auto-detects the button fill behind it as the background (geometry/intersection). I never had to select two things.
- **It measures whatever you select** uniformly — a text node vs. its button, or a button shape vs. the page — both resolve to an fg/bg pair.
- **It correctly handles opacity** — the 20%-opacity `rest` danger button read ~0 ("Invisible"), flagging a near-transparent control as failing.
- **The ⚙ gear cycles the color format** — confirmed switching the fg/bg readouts from **OKLCH** (`82% 0.1 151`) to **RGB** (`139 139 152`).

---

## 4. The verdict thresholds (source: `src/ui/services/apca/conclusion.ts`)

```ts
const conclusions = {
  "Fluent Text": 90,
  "Body Text": 75,
  "Content Text": 60,
  "Large Text": 45,
  "Non-Text": 30,
  "Not Readable": 15,
  Invisible: 0
};
// getConclusionByScore: first tier whose threshold ≤ |Lc|
```

Every live reading maps exactly: Lc 76 ≥ 75 → Body Text; 58 ≥ 45 → Large Text; 29/18 ≥ 15 → Not Readable; ~0 → Invisible. (There's a cute easter-egg: Huetone has "Nice" at Lc 69; Polychrom's is just the clean tier table.)

**This is the same APCA tier table our `fontLookup.ts` `contrastTier` uses** (fluent/body/content/large/nonText/minimum/insufficient — same 90/75/60/45/30/15 breakpoints, different labels).

---

## 5. Other source-confirmed details

- **Color formats** (`src/constants.ts` `ColorSpaceDisplayModes`): **OKLCH, RGB, HEX** — the gear cycles these. (P3 variants exist in `apcachToCss`: `figma-p3 | hex | oklch | p3 | rgb`.)
- **Font recommendations** use `fontLookupAPCA(contrast)` from the `apca-w3` package (returns the per-weight min-size array) — the same table we vendored into `fontLookup.ts`. The two displayed sizes are the **weight-400 and weight-700** entries.
- **APCA math** is the official `apca-w3` (`calcAPCA`, `APCAcontrast`, `displayP3toY`) — same source as ours via colorjs.io.
- **fg/bg detection** (`src/ui/services/figma/find-fg-and-bg-nodes.ts`, from prior research): flatten the node tree → sort by depth + paint (z) order → the **selected** node is foreground, the nearest underlying intersecting node is background. Supports an explicit **two-node selection** (`TwoNodesSelectionPairId`) to pick fg + bg manually.
- **Blend/opacity compositing** (`src/ui/services/blend/`): composites semi-transparent fills before measuring (why the 20% button read correctly).

---

## 6. Gap analysis vs. our selection-contrast feature (Phase 5)

### Where we already match

- **APCA Lc + the same tier table** — our `contrastTier` thresholds are identical (90/75/60/45/30/15).
- **APCA font-lookup** — our `fontLookup.ts` is the same `apca-w3` table; we compute pass/fail per size+weight.
- **Sandbox fg/bg extraction** — our `selection.ts` does the "selected = fg, ancestor/page = bg" version, and skips invisible/0-opacity paints.

### Where Polychrom is ahead (worth adopting)

1. **The "Aa" preview chip in the real fg/bg pair** — you _see_ the legibility, not just a number. (Huetone does this too; we don't yet. High value, low effort.)
2. **Color readouts in OKLCH (+ RGB/HEX toggle)** — directly useful in our okLCH-native context; a format switch is cheap.
3. **The two font-size recommendations (w400 / w700) shown inline** — we have the table but display a single pass/fail; showing the _minimum legible size_ per weight is more actionable.
4. **Explicit two-node selection mode** — pick fg + bg manually when auto-detection isn't what you want.
5. **Opacity/blend compositing before measuring** — we currently take the solid fill's opacity but don't composite a stack of semi-transparent fills (we deferred full blend compositing). Polychrom's 20%-button reading shows why it matters: without compositing, a low-opacity control's true contrast is mis-stated.
6. **The clean single-purpose panel** — verdict + big number + range bar + preview + colors, all in ~328×260. A tight, legible layout to emulate for our contrast readout.

### Where we're ahead

- **We're a full palette editor**, not a single-purpose checker — the selection contrast is one feature among many.
- **We also show WCAG** alongside APCA (Polychrom is APCA-only).
- **We have the contrast grid** (every pairing matrix) — Polychrom has no equivalent.

---

## 7. Source map (Polychrom, commit `5e275a0`)

| Concern               | Files                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Verdict tiers**     | `src/ui/services/apca/conclusion.ts` (`conclusions`, `getConclusionByScore`)                                                                |
| **Color formats**     | `src/constants.ts` (`ColorSpaceDisplayModes` OKLCH/RGB/HEX), `src/utils/colors/formatters.ts`, `src/ui/services/blend/format-color-data.ts` |
| **APCA + font table** | `apca-w3` package (`calcAPCA`, `fontLookupAPCA`); `src/utils/apca/`                                                                         |
| **fg/bg detection**   | `src/ui/services/figma/find-fg-and-bg-nodes.ts`, intersection services under `src/api/services/figma/intersections/`                        |
| **Blend/opacity**     | `src/ui/services/blend/`, `blend-modes/`; `src/api/services/figma/nodes/get-node-fills.ts`                                                  |
| **Selection pairs**   | `TwoNodesSelectionPairId` (two-node manual mode)                                                                                            |

**Reference screenshots** captured live this session (green-text Lc76, grey-text Lc58 RGB, disabled-red Lc18, disabled-green-shape Lc29) — regenerate via the live plugin as needed; not committed.
