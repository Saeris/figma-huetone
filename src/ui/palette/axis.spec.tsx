/**
 * @vitest-environment jsdom
 *
 * Component tests for the axis editor (Phase 3, jsdom). These assert the editing
 * affordances fire the right callbacks (which App wires to the sandbox axis ops):
 * renaming a chip on blur, removing a chip, and adding a new group/scale. They also
 * assert the guards that prevent silent data loss — a rename to an empty or
 * duplicate name is rejected.
 */

import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxisEditor } from "./AxisEditor.js";

const renderEditor = (
  overrides: Partial<React.ComponentProps<typeof AxisEditor>> = {}
): React.ComponentProps<typeof AxisEditor> => {
  const props: React.ComponentProps<typeof AxisEditor> = {
    groups: ["red", "blue"],
    scales: ["100", "500"],
    onRenameGroup: vi.fn<(from: string, to: string) => void>(),
    onRemoveGroup: vi.fn<(name: string) => void>(),
    onAddGroup: vi.fn<(name: string) => void>(),
    onRenameScale: vi.fn<(from: string, to: string) => void>(),
    onRemoveScale: vi.fn<(scale: string) => void>(),
    onAddScale: vi.fn<(scale: string) => void>(),
    ...overrides
  };
  render(<AxisEditor {...props} />);
  return props;
};

describe("axisEditor", () => {
  it("renames a group when its chip loses focus with a new value", async () => {
    const user = userEvent.setup();
    const props = renderEditor();

    const input = screen.getByLabelText("Rename Group red");
    await user.clear(input);
    await user.type(input, "crimson");
    await user.tab(); // blur

    expect(props.onRenameGroup).toHaveBeenCalledWith("red", "crimson");
  });

  it("does not rename to a duplicate or empty name", async () => {
    const user = userEvent.setup();
    const props = renderEditor();

    const input = screen.getByLabelText("Rename Group red");
    await user.clear(input); // empty
    await user.tab();
    expect(props.onRenameGroup).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, "blue"); // duplicate
    await user.tab();
    expect(props.onRenameGroup).not.toHaveBeenCalled();
  });

  it("removes a group", async () => {
    const user = userEvent.setup();
    const props = renderEditor();

    await user.click(screen.getByLabelText("Remove Group blue"));
    expect(props.onRemoveGroup).toHaveBeenCalledWith("blue");
  });

  it("adds a new scale via the add input + button", async () => {
    const user = userEvent.setup();
    const props = renderEditor();

    const add = screen.getByLabelText("Add Scale");
    await user.type(add, "900");
    await user.click(
      screen.getAllByRole("button", { name: "Add" })[1] // second add row = scales
    );
    expect(props.onAddScale).toHaveBeenCalledWith("900");
  });

  it("adds a group on Enter", async () => {
    const user = userEvent.setup();
    const props = renderEditor();

    const add = screen.getByLabelText("Add Group");
    await user.type(add, "green{Enter}");
    expect(props.onAddGroup).toHaveBeenCalledWith("green");
  });
});
