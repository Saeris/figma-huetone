/**
 * Tests for the APCA font-lookup table (Phase 5). These assert the typography
 * discipline the whole contrast feature exists for (SPEC §2.5): the same Lc passes
 * for large/bold text but fails for small body text, the min-size lookup matches the
 * APCA table at representative points, weights snap to the nearest column, and the
 * tier labels bucket Lc correctly. Pure — no DOM.
 */

import { describe, expect, it } from "vitest";
import { contrastTier, minFontSize, NEVER, passesAPCA } from "./fontLookup.js";

describe("minFontSize", () => {
  it("requires a larger min size at lower contrast", () => {
    // For a fixed weight, lower Lc demands a bigger font.
    expect(minFontSize(90, 400)).toBeLessThan(minFontSize(60, 400));
    expect(minFontSize(60, 400)).toBeLessThan(minFontSize(45, 400));
  });

  it("requires a larger min size at lighter weight", () => {
    // At a fixed Lc, thin text needs to be bigger than bold text.
    expect(minFontSize(60, 100)).toBeGreaterThan(minFontSize(60, 700));
  });

  it("snaps an arbitrary weight to the nearest table column", () => {
    // 420 ≈ 400; 480 ≈ 500.
    expect(minFontSize(75, 420)).toBe(minFontSize(75, 400));
    expect(minFontSize(75, 480)).toBe(minFontSize(75, 500));
  });

  it("marks text never-acceptable in the floor row, and unusable below the table", () => {
    // Lc 25–29 lands in the floor row: text is never acceptable (NEVER).
    expect(minFontSize(26, 400)).toBe(NEVER);
    // Below Lc 25 the contrast is off the table entirely → no legible size.
    expect(minFontSize(20, 400)).toBe(Infinity);
  });
});

describe("passesAPCA", () => {
  it("passes large bold text but fails small body text at the same Lc", () => {
    // Lc 60: fine for 24px/700, not for 14px/400.
    expect(passesAPCA(60, 24, 700)).toBe(true);
    expect(passesAPCA(60, 14, 400)).toBe(false);
  });

  it("is polarity-insensitive (uses absolute Lc)", () => {
    expect(passesAPCA(-75, 18, 400)).toBe(passesAPCA(75, 18, 400));
  });

  it("never passes when the contrast is below the floor", () => {
    expect(passesAPCA(20, 100, 900)).toBe(false);
  });
});

describe("contrastTier", () => {
  it("buckets Lc into readability tiers (absolute)", () => {
    expect(contrastTier(95)).toBe("fluent");
    expect(contrastTier(-78)).toBe("body");
    expect(contrastTier(62)).toBe("content");
    expect(contrastTier(46)).toBe("large");
    expect(contrastTier(31)).toBe("nonText");
    expect(contrastTier(16)).toBe("minimum");
    expect(contrastTier(5)).toBe("insufficient");
  });
});
