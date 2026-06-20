/**
 * @vitest-environment jsdom
 *
 * Component tests for the export panel (Phase 7, jsdom). These assert the user can
 * preview the palette in either format and copy it: the preview reflects the chosen
 * format, switching formats re-renders it, and Copy writes the current output to the
 * clipboard.
 */

import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { colorTokenFromOklch, type TokenGroup } from "../tokens/index.js";
import { ExportPanel } from "./ExportPanel.js";

const tree: TokenGroup = {
  $type: "color",
  red: { "500": colorTokenFromOklch({ l: 0.6, c: 0.2, h: 25 }, "srgb") }
};

describe("exportPanel", () => {
  it("previews CSS variables by default", () => {
    render(<ExportPanel tree={tree} />);
    const preview =
      screen.getByLabelText<HTMLTextAreaElement>("Export preview");
    expect(preview.value).toContain("--red-500:");
    expect(preview.value).toContain(":root {");
  });

  it("switches the preview to DTCG JSON", async () => {
    const user = userEvent.setup();
    render(<ExportPanel tree={tree} />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Format" }),
      "dtcg"
    );
    const preview =
      screen.getByLabelText<HTMLTextAreaElement>("Export preview");
    expect(preview.value).toContain('"$value"');
    expect(preview.value).not.toContain(":root {");
  });

  it("copies the current output to the clipboard", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(async () =>
      Promise.resolve()
    );
    const user = userEvent.setup();
    // Define our clipboard mock AFTER setup() — user-event installs its own stub on
    // setup, and jsdom's navigator.clipboard is otherwise getter-only.
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true
    });
    render(<ExportPanel tree={tree} />);

    await user.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining("--red-500:")
      )
    );
    await expect(
      screen.findByRole("button", { name: "Copied!" })
    ).resolves.toBeInTheDocument();
  });
});
