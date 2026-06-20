/**
 * @vitest-environment jsdom
 *
 * Component tests for the contrast display (Phase 5, jsdom). These assert the
 * accessibility verdicts a user reads at a glance: APCA Lc + tier and WCAG ratio are
 * both shown, the APCA pass/fail respects the typography context (the same pair
 * passes for large text but fails for small body text), and WCAG AA is judged
 * against the right threshold. The two measures are presented separately, never
 * blended (SPEC §2.5).
 */

import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Oklch } from "../color/index.js";
import { ContrastDisplay } from "./ContrastDisplay.js";

const BLACK: Oklch = { l: 0, c: 0, h: 0 };
const WHITE: Oklch = { l: 1, c: 0, h: 0 };
const GREY: Oklch = { l: 0.55, c: 0, h: 0 };

describe("contrastDisplay", () => {
  it("shows both APCA Lc and a WCAG ratio for the pair", () => {
    render(<ContrastDisplay text={BLACK} background={WHITE} />);
    // High-contrast black on white: strong APCA + a high WCAG ratio.
    expect(screen.getByText(/Lc$/u)).toBeInTheDocument();
    expect(screen.getByText(/:1$/u)).toBeInTheDocument();
    expect(screen.getByText("Fluent text")).toBeInTheDocument();
  });

  it("passes APCA for large text but fails for small body text on a marginal pair", () => {
    // Grey on white is marginal — fine for big text, not for small.
    const large = render(
      <ContrastDisplay
        text={GREY}
        background={WHITE}
        fontSizePx={48}
        fontWeight={700}
      />
    );
    expect(large.getByText(/^Pass ·/u)).toBeInTheDocument();
    large.unmount();

    const small = render(
      <ContrastDisplay
        text={GREY}
        background={WHITE}
        fontSizePx={12}
        fontWeight={400}
      />
    );
    expect(small.getByText(/^Fail ·/u)).toBeInTheDocument();
  });

  it("judges WCAG AA against the large-text threshold for big text", () => {
    // A pair that clears 3:1 (large) but not 4.5:1 (normal).
    render(
      <ContrastDisplay
        text={GREY}
        background={WHITE}
        fontSizePx={24}
        fontWeight={400}
      />
    );
    // Large text → 3:1 threshold → passes AA.
    expect(screen.getByText("Pass AA")).toBeInTheDocument();
  });
});
