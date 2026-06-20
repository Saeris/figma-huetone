/**
 * Sandbox-side selection contrast extraction (Phase 5, SPEC §2.3) — the Polychrom-
 * style "what's the contrast of my current selection?" feature. It reads the canvas
 * selection, pulls the foreground node's solid fill, finds a background (a second
 * selected node, else the nearest ancestor with a solid fill, else the page
 * background), and ships the RGBA pair across the bridge. The UI converts to okLCH
 * and computes APCA/WCAG — the sandbox does no color math.
 *
 * Phase 5 keeps fg/bg detection pragmatic: the *last* selected node is the
 * foreground (matching how you'd select text last over its container), and the
 * background is resolved by the simple precedence above. Full geometric z-order
 * intersection and multi-layer blend compositing are deferred.
 */

import type { SelectionColor, SelectionContrast } from "../ipc/contract.js";

/** A node that may carry solid fills (the shape we read). */
interface FillableNode {
  name: string;
  fills?: readonly Paint[] | symbol;
  parent?: BaseNode | null;
}

/** The first visible, opaque-enough SOLID paint in a fills array, as RGBA. */
const solidFill = (
  fills: readonly Paint[] | symbol | undefined
): { r: number; g: number; b: number; a: number } | null => {
  if (!Array.isArray(fills)) return null; // `mixed` symbol or none
  // Topmost paint wins, so scan from the end.
  for (let i = fills.length - 1; i >= 0; i--) {
    const paint = fills[i];
    if (paint.type === "SOLID" && paint.visible !== false) {
      const opacity = paint.opacity ?? 1;
      if (opacity <= 0) continue;
      const { r, g, b } = paint.color;
      return { r, g, b, a: opacity };
    }
  }
  return null;
};

const asColor = (node: FillableNode): SelectionColor | null => {
  const rgba = solidFill(node.fills);
  return rgba ? { label: node.name, rgba } : null;
};

/** Walk up ancestors for the first node with a solid fill (the visual background). */
const ancestorBackground = (node: FillableNode): SelectionColor | null => {
  let current = node.parent as FillableNode | null | undefined;
  while (current) {
    const color = asColor(current);
    if (color) return color;
    current = current.parent as FillableNode | null | undefined;
  }
  return null;
};

/** The page background as a fallback. */
const pageBackground = (): SelectionColor | null => {
  const page = figma.currentPage;
  const rgba = solidFill(page.backgrounds);
  return rgba ? { label: "Page", rgba } : null;
};

/**
 * Derive the foreground/background contrast pair from the current selection, or
 * `null` when it doesn't yield a usable pair (nothing selected, no solid fill, or
 * foreground and background can't both be resolved).
 */
export const selectionContrast = (): SelectionContrast | null => {
  const selection = figma.currentPage.selection as readonly FillableNode[];
  if (selection.length === 0) return null;

  // Foreground: the last selected node with a solid fill.
  const fgNode = [...selection].reverse().find((n) => solidFill(n.fills));
  if (!fgNode) return null;
  const foreground = asColor(fgNode);
  if (!foreground) return null;

  // Background: a different selected node, else an ancestor, else the page.
  const otherSelected = selection.find(
    (n) => n !== fgNode && solidFill(n.fills)
  );
  const background =
    (otherSelected ? asColor(otherSelected) : null) ??
    ancestorBackground(fgNode) ??
    pageBackground();
  if (!background) return null;

  return { foreground, background };
};
