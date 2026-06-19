/**
 * @vitest-environment jsdom
 *
 * Component tests for the Phase 2 grid + editor (jsdom, testing-ladder tier 2).
 * These assert the user-facing behaviors that matter: every swatch renders as a
 * selectable control, out-of-gamut swatches are flagged, and editing a channel in
 * the editor derives a new okLCH and calls back the parent's persist handler (the
 * `editToken` path) — including keeping the okLCH source even when the result is
 * gamut-clipped.
 */

import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Oklch } from "../color/index.js";
import { RampGrid, SwatchEditor, type SwatchVM, toPaletteVM } from "./index.js";
import { colorTokenFromOklch, type TokenGroup } from "../tokens/index.js";

const token = (color: Oklch): TokenGroup =>
  colorTokenFromOklch(color, "srgb") as unknown as TokenGroup;

describe("ramp grid", () => {
  it("renders a selectable swatch button per cell, labeled by group and scale", () => {
    const tree: TokenGroup = {
      $type: "color",
      red: {
        "100": token({ l: 0.9, c: 0.05, h: 25 }),
        "500": token({ l: 0.6, c: 0.15, h: 25 })
      }
    };
    const onSelect = vi.fn<(swatch: SwatchVM) => void>();
    render(
      <RampGrid
        palette={toPaletteVM(tree)}
        gamut="srgb"
        selectedPath={null}
        onSelect={onSelect}
      />
    );

    expect(screen.getByRole("button", { name: "red 100" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "red 500" })).toBeInTheDocument();
  });

  it("calls onSelect with the clicked swatch", async () => {
    const tree: TokenGroup = {
      $type: "color",
      red: { "500": token({ l: 0.6, c: 0.15, h: 25 }) }
    };
    const onSelect = vi.fn<(swatch: SwatchVM) => void>();
    const user = userEvent.setup();
    render(
      <RampGrid
        palette={toPaletteVM(tree)}
        gamut="srgb"
        selectedPath={null}
        onSelect={onSelect}
      />
    );

    await user.click(screen.getByRole("button", { name: "red 500" }));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ path: ["red", "500"] })
    );
  });

  it("flags an out-of-sRGB swatch in its accessible label", () => {
    // Vivid green is outside sRGB.
    const tree: TokenGroup = {
      $type: "color",
      green: { "500": token({ l: 0.86, c: 0.29, h: 142 }) }
    };
    render(
      <RampGrid
        palette={toPaletteVM(tree)}
        gamut="srgb"
        selectedPath={null}
        onSelect={vi.fn<(swatch: SwatchVM) => void>()}
      />
    );
    expect(
      screen.getByRole("button", { name: /green 500 \(out of gamut\)/u })
    ).toBeInTheDocument();
  });
});

describe("swatch editor", () => {
  const swatch = {
    path: ["red", "500"],
    group: "red",
    scale: "500",
    oklch: { l: 0.6, c: 0.15, h: 25, alpha: 1 } as Oklch
  };

  it("persists a derived okLCH edit when a channel changes", async () => {
    const onEdit = vi.fn<(path: string[], color: Oklch) => void>();
    const user = userEvent.setup();
    render(<SwatchEditor swatch={swatch} gamut="srgb" onEdit={onEdit} />);

    // Bump lightness to 0.7.
    const l = screen.getByLabelText("L");
    await user.clear(l);
    await user.type(l, "0.7");

    // Each keystroke fires; wait until the final L=0.7 edit lands for this path.
    await waitFor(() =>
      expect(onEdit).toHaveBeenCalledWith(
        ["red", "500"],
        expect.objectContaining({ l: 0.7 })
      )
    );
  });

  it("shows the out-of-gamut notice when the edited color leaves the gamut", async () => {
    const onEdit = vi.fn<(path: string[], color: Oklch) => void>();
    const user = userEvent.setup();
    render(<SwatchEditor swatch={swatch} gamut="srgb" onEdit={onEdit} />);

    // Push chroma well past the sRGB boundary for this hue/lightness.
    const c = screen.getByLabelText("C");
    await user.clear(c);
    await user.type(c, "0.4");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/Outside sRGB/u)
    );
  });
});
