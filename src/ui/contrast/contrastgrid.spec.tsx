/**
 * @vitest-environment jsdom
 *
 * Component tests for the contrast grid (Phase 6, jsdom). These assert the matrix
 * renders a labeled cell per foreground×background pair, marks each pass/fail, and
 * re-filters live when the font size/weight changes — the contrast.tools behavior of
 * seeing which pairings work for a given typography context.
 */

import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Oklch } from "../color/index.js";
import { ContrastGrid } from "./ContrastGrid.js";
import type { GridColor } from "./grid.js";

const color = (id: string, oklch: Oklch): GridColor => ({ id, oklch });
const WHITE = color("white", { l: 1, c: 0, h: 0 });
// A light grey: marginal contrast on white — fails small body text, passes big bold.
const GREY = color("grey", { l: 0.72, c: 0, h: 0 });

describe("contrastGrid component", () => {
  it("renders a pass/fail mark per foreground×background cell", () => {
    render(<ContrastGrid foregrounds={[GREY]} backgrounds={[WHITE]} />);
    // Default 16px/400: light grey on white fails APCA body text.
    expect(screen.getByLabelText("grey on white fails")).toBeInTheDocument();
  });

  it("re-filters the verdict when the font size grows", async () => {
    const user = userEvent.setup();
    render(<ContrastGrid foregrounds={[GREY]} backgrounds={[WHITE]} />);

    // Starts failing at 16px/400…
    expect(screen.getByLabelText("grey on white fails")).toBeInTheDocument();

    // …bump size to 36px and bold weight → now passes.
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Size" }),
      "36"
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Weight" }),
      "700"
    );
    expect(screen.getByLabelText("grey on white passes")).toBeInTheDocument();
  });

  it("renders column and row headers from the color ids", () => {
    render(
      <ContrastGrid
        foregrounds={[color("red/500", { l: 0.6, c: 0.2, h: 25 })]}
        backgrounds={[WHITE]}
      />
    );
    expect(screen.getByText("red/500")).toBeInTheDocument();
    expect(screen.getByText("white")).toBeInTheDocument();
  });
});
