/**
 * Tests for sandbox selection contrast extraction (Phase 5) against an in-memory
 * Figma fake. These assert the fg/bg precedence the readout depends on: the last
 * selected node is foreground; the background resolves to a second selected node,
 * else an ancestor with a solid fill, else the page background; and the cases that
 * yield no usable pair return null. No real Figma, no DOM.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { selectionContrast } from "./selection.js";

interface RGB {
  r: number;
  g: number;
  b: number;
}
interface Paint {
  type: string;
  color?: RGB;
  visible?: boolean;
  opacity?: number;
}
interface FakeNode {
  name: string;
  fills?: Paint[];
  parent?: FakeNode | null;
}

const solid = (
  name: string,
  color: RGB,
  opacity = 1,
  parent: FakeNode | null = null
): FakeNode => ({
  name,
  fills: [{ type: "SOLID", color, opacity }],
  parent
});

const installFigma = (selection: FakeNode[], pageBg: Paint[] = []): void => {
  (globalThis as { figma?: unknown }).figma = {
    currentPage: { selection, backgrounds: pageBg }
  };
};

describe("selectionContrast", () => {
  beforeEach(() => installFigma([]));
  afterEach(() => {
    delete (globalThis as { figma?: unknown }).figma;
  });

  it("returns null when nothing is selected", () => {
    installFigma([]);
    expect(selectionContrast()).toBeNull();
  });

  it("returns null when the selected node has no solid fill", () => {
    installFigma([{ name: "Empty", fills: [] }]);
    expect(selectionContrast()).toBeNull();
  });

  it("pairs two selected nodes as foreground (last) and background", () => {
    const bg = solid("Card", { r: 1, g: 1, b: 1 });
    const fg = solid("Label", { r: 0, g: 0, b: 0 });
    installFigma([bg, fg]);

    const result = selectionContrast();
    expect(result?.foreground.label).toBe("Label");
    expect(result?.background.label).toBe("Card");
    expect(result?.foreground.rgba).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it("falls back to an ancestor's fill for the background", () => {
    const container = solid("Container", { r: 0.9, g: 0.9, b: 0.9 });
    const text = solid("Text", { r: 0.1, g: 0.1, b: 0.1 }, 1, container);
    installFigma([text]);

    const result = selectionContrast();
    expect(result?.foreground.label).toBe("Text");
    expect(result?.background.label).toBe("Container");
  });

  it("falls back to the page background when there's no ancestor fill", () => {
    const text = solid("Text", { r: 0, g: 0, b: 0 });
    installFigma([text], [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }]);

    const result = selectionContrast();
    expect(result?.background.label).toBe("Page");
  });

  it("skips invisible and fully-transparent paints", () => {
    const bg = solid("BG", { r: 1, g: 1, b: 1 });
    const fg: FakeNode = {
      name: "FG",
      fills: [
        { type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 0 },
        { type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 }, visible: false },
        { type: "SOLID", color: { r: 0.3, g: 0.3, b: 0.3 }, opacity: 1 }
      ]
    };
    installFigma([bg, fg]);

    // The topmost visible, non-transparent paint wins.
    expect(selectionContrast()?.foreground.rgba).toEqual({
      r: 0.3,
      g: 0.3,
      b: 0.3,
      a: 1
    });
  });
});
