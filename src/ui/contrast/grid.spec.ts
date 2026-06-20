/**
 * Tests for the contrast-grid model (Phase 6). These assert the matrix the grid
 * renders: each cell carries the APCA + WCAG verdict for its foreground-on-background
 * pair, the matrix is laid out foreground-row × background-column, and the font
 * context only shifts the pass/fail thresholds (not the pair-intrinsic Lc). Pure.
 */

import { describe, expect, it } from "vitest";
import type { Oklch } from "../color/index.js";
import { contrastGrid, type GridColor } from "./grid.js";

const color = (id: string, oklch: Oklch): GridColor => ({ id, oklch });

const WHITE = color("white", { l: 1, c: 0, h: 0 });
const BLACK = color("black", { l: 0, c: 0, h: 0 });
const GREY = color("grey", { l: 0.55, c: 0, h: 0 });

describe("contrastGrid", () => {
  it("lays out foreground rows × background columns", () => {
    const grid = contrastGrid([BLACK, WHITE], [WHITE, BLACK], {
      sizePx: 16,
      weight: 400
    });
    expect(grid.cells).toHaveLength(2); // two foregrounds
    expect(grid.cells[0]).toHaveLength(2); // two backgrounds
  });

  it("computes a strong, passing verdict for black on white", () => {
    const grid = contrastGrid([BLACK], [WHITE], { sizePx: 16, weight: 400 });
    const cell = grid.cells[0][0];
    expect(cell.tier).toBe("fluent");
    expect(cell.apcaPass).toBe(true);
    expect(cell.wcagPass).toBe(true);
    expect(cell.ratio).toBeGreaterThan(20);
  });

  it("keeps the Lc constant but flips the APCA pass as the font shrinks", () => {
    const big = contrastGrid([GREY], [WHITE], { sizePx: 48, weight: 700 });
    const small = contrastGrid([GREY], [WHITE], { sizePx: 12, weight: 400 });
    // The pair-intrinsic Lc is identical...
    expect(small.cells[0][0].lc).toBe(big.cells[0][0].lc);
    // ...but the typography verdict differs.
    expect(big.cells[0][0].apcaPass).toBe(true);
    expect(small.cells[0][0].apcaPass).toBe(false);
  });

  it("signs Lc by polarity (dark-on-light positive, light-on-dark negative)", () => {
    // White-on-black is light-on-dark → negative Lc; black-on-white → positive.
    const grid = contrastGrid([BLACK, WHITE], [WHITE, BLACK], {
      sizePx: 16,
      weight: 400
    });
    expect(grid.cells[0][0].lc).toBeGreaterThan(0); // black on white
    expect(grid.cells[1][1].lc).toBeLessThan(0); // white on black
  });
});
