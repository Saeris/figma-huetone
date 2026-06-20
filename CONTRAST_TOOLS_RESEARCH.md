# contrast.tools Research

> Study of [contrast.tools](https://contrast.tools/) (by Protean Studio) — the reference for our Phase 6 contrast grid (SPEC §2.6). Conducted 2026-06-20 by **driving the live tool** with Playwright across passing/borderline/failing color combos on both its tabs, **and** reading its source (it turned out to be **open source**: [proteanstudio/contrast-tools](https://github.com/proteanstudio/contrast-tools), commit `4c9b305`). So this is observed behavior confirmed against exact logic, not reverse-engineering.

Reference material for our contrast UI, not a plan.

---

## 1. Open-source status

**Open source.** The footer "Github issue" link resolves to `github.com/proteanstudio/contrast-tools` — a TypeScript + webpack app using custom web components (`protean-input`, `protean-tab-container`, etc.). We can read the exact contrast logic rather than infer it (and we did — §4).

---

## 2. What it is + UI structure

A focused two-standard contrast checker. Top has **two tabs: "APCA" and "WCAG 2.1"**. Shared controls:

- **Text color** input + native color picker; **Background color** input + picker. (Both are `protean-input` web components — the editable value lives in shadow DOM; to drive them you focus and type, native value-setters don't trigger their reactivity.)
- **Use RGB / Use Hex** radio toggle (color value format).
- A center **"Contrast value"** readout (Lc on the APCA tab, ratio on WCAG) with a swap-direction arrow.
- A **"Sample text"** preview rendered in the actual pair, and a **"Share these colors"** button (URL-encodes the colors + tab, e.g. `?tab=wcag-21`).

The two tabs present contrast completely differently (the key insight):

- **APCA tab** → the **font-size × weight Lookup Table** (the "grid").
- **WCAG tab** → four flat **AA/AAA × normal/large PASS/FAIL badges**.

---

## 3. Observed behavior (driven live)

### APCA tab — the Lookup Table grid

A matrix: **font weight (100–900) across columns, font size (≈12px → 42px+) down rows**. Each cell shows a rating mark for "is this size+weight legible at the current contrast." A "Table key" legend explains the marks. **The grid degrades smoothly as contrast drops** — I drove three combos and watched it change:

| fg / bg               | APCA Lc    | Grid behavior                                                                  |
| --------------------- | ---------- | ------------------------------------------------------------------------------ |
| `#000000` / `#ffffff` | **106.04** | nearly all cells "X" (rating 4, full pass)                                     |
| `#767676` / `#ffffff` | **71.57**  | small/light cells drop to ratings 1–3 (marginal); large/bold still pass        |
| `#bbbbbb` / `#ffffff` | **36.72**  | mostly rating dots (0–1, fail/marginal); only the largest + boldest cells pass |

Note `#767676` on white is the _classic WCAG-exactly-4.5:1 gray_, yet APCA rates it **71.57 Lc — just under the 75 "body text" mark**. A clean demonstration that APCA and WCAG disagree at the margins (APCA is stricter for small text on this pairing).

### WCAG 2.1 tab — flat badges

The same colors, shown as the textbook model:

- **Contrast value** as a ratio (e.g. `1.92:1`, `7.00:1`).
- **"Normal text"**: WCAG 2.1 AA / AAA → PASS or FAIL.
- **"Large text"** (defined inline: "14pt (18.67px) and bold or any text bigger than 18pt (24px)"): AA / AAA → PASS or FAIL.

Observed: `#bbbbbb`/white = **1.92:1 → all four FAIL**; `#595959`/white = **7.00:1 → all four PASS** (AA needs 4.5, AAA needs 7, large AA 3 / AAA 4.5).

---

## 4. Exact logic (from source)

### WCAG ratio (`src/utils/legacy-ratio/index.ts`)

The canonical WCAG 2.x relative-luminance formula — **identical to what our `wcag21` (colorjs.io `contrastWCAG21`) computes** (verified: my live readings matched):

```ts
function luminance(rgb) {
  // sRGB → relative luminance
  const m = [0.2126, 0.7152, 0.0722];
  return rgb.reduce((acc, c, i) => {
    let n = c / 255;
    n = n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    return acc + n * m[i];
  }, 0);
}
function legacyContrast(rgb1, rgb2) {
  const [d, b] = [Math.min(l1, l2), Math.max(l1, l2)];
  return (b + 0.05) / (d + 0.05); // 1..21
}
```

### APCA grid rating (`src/utils/apca-rating/index.ts`) — the important one

The grid is **NOT binary pass/fail**. Each cell has a _required_ Lc (from the APCA lookup table for that size+weight); `APCARating` buckets how far the actual |Lc| falls short into a **0–4 rating**:

```ts
function APCARating(
  comparisonValue /* actual |Lc| */,
  value /* required Lc */
) {
  const percentageDiff = (Math.abs(comparisonValue) * 100) / value - 100;
  if (percentageDiff >= 0) return 4; // meets/exceeds → full pass
  const normalizedDiff = Math.floor(percentageDiff / 5) * 5;
  return (
    new Map([
      [0, 4],
      [-5, 3],
      [-10, 2],
      [-15, 1]
    ]).get(normalizedDiff) ?? 0
  );
}
```

So per cell: **meets required → 4**; **0–5% below → 3**; **5–10% → 2**; **10–15% → 1**; **>15% below → 0 (fail)**. This is exactly the "Table key" legend ("Rating 1 – 5% below", etc.) and the smooth degradation I watched. The actual Lc uses the official `apca-w3` algorithm (same source as our colorjs.io APCA).

---

## 5. Gap analysis vs. our Phase 6 contrast grid

### Where we match

- **Same two standards** — APCA + WCAG, each with its own presentation. Our `ContrastGrid` (APCA per size+weight) + `ContrastDisplay` (WCAG AA) cover both.
- **Same WCAG math** (`wcag21`) and **same APCA + font lookup** (`fontLookup.ts`).
- **Live re-filter by font size/weight** — both tools recompute the grid as the typography context changes.

### Where contrast.tools is ahead (worth adopting)

1. **GRADED cell rating (0–4), not binary.** Our grid cells are ✓/✕ (`apcaPass`). contrast.tools shows _how close_ a marginal cell is (within 5/10/15% of required) — far more actionable for nudging a color just over the line. **This is the main thing to adopt:** compute `(|Lc|/required − 1)` per cell and bucket it, instead of a boolean.
2. **A full size×weight matrix as the primary view** (weights 100–900 × sizes 12–42px), with a legend. Ours scopes fg×bg pairs and filters by one size/weight; contrast.tools fixes the _pair_ and shows the whole typography matrix for it. Two complementary framings — we may want both: "this pair across all type sizes" AND "all pairs at one type size."
3. **WCAG presented as the four canonical badges** (AA/AAA × normal/large) with the large-text definition inline — clearer than a single AA verdict.
4. **Share-by-URL** (encodes colors + tab).

### Where we're ahead

- We're a **palette editor**, not a single-pair checker — our grid spans _every swatch pair_, which contrast.tools has no concept of.
- We compute in **okLCH** natively and gamut-map; contrast.tools is RGB/hex in.

---

## 6. Source map (proteanstudio/contrast-tools, commit `4c9b305`)

| Concern                    | File                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| **WCAG ratio**             | `src/utils/legacy-ratio/index.ts` (`luminance`, `legacyContrast`)                            |
| **APCA cell rating (0–4)** | `src/utils/apca-rating/index.ts` (`APCARating`)                                              |
| **APCA Lc**                | official `apca-w3` algorithm                                                                 |
| **Color parse/convert**    | `src/utils/colors/`                                                                          |
| **Components**             | `src/components/` (the tabs, color inputs, lookup-table grid; web components in `protean-*`) |

**Reference screenshots** captured live this session (black/white Lc106 grid, gray Lc71 grid, light-gray Lc36 grid, WCAG 1.92 fail, WCAG 7.0 pass) — regenerate via the live tool as needed; not committed.
