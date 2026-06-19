/**
 * @vitest-environment jsdom
 *
 * Integration tests for the form composition layer (SPEC §2.11). The UI runs in an
 * iframe ≈ Chromium, so these run in jsdom (testing-ladder tier 2). They prove the
 * pieces work TOGETHER as the real plugin will use them:
 *
 * - fields attach to the ambient form by a typed `names` node, no prop-drilling;
 * - a Valibot schema (the value-shape source of truth) validates on submit and
 *   surfaces messages through `FieldError`;
 * - `Control` binds a CUSTOM (non-native) control to form state — the pattern our
 *   okLCH sliders will use — and edits flow back into the form value.
 */

import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { valibotResolver } from "@hookform/resolvers/valibot";
import * as v from "valibot";
import type { JSX } from "react";
import { Control, Field, FieldError, Form, useTypedForm } from "./index.js";

// The Valibot schema IS the form's value shape — and thus the source of truth the
// `names` proxy is typed against.
const Schema = v.object({
  label: v.pipe(v.string(), v.minLength(1, "Label is required")),
  swatch: v.object({
    l: v.pipe(v.number(), v.minValue(0), v.maxValue(1))
  })
});
type Values = v.InferOutput<typeof Schema>;

const Harness = ({
  onSubmit
}: {
  onSubmit: (values: Values) => void;
}): JSX.Element => {
  const form = useTypedForm<Values>({
    resolver: valibotResolver(Schema),
    defaultValues: { label: "", swatch: { l: 0.5 } }
  });
  return (
    <Form form={form} onSubmit={onSubmit}>
      {/* Native field attached by a typed `names` node. */}
      <label>
        Label
        <Field<Values> name={form.names.label} />
      </label>
      <FieldError<Values> name={form.names.label} />

      {/* Custom control bound via Control — the okLCH-slider pattern. A plain
          number input stands in for the slider here. */}
      <Control<Values> name={form.names.swatch.l}>
        {({ field }) => (
          <label>
            Lightness
            <input
              type="number"
              aria-label="lightness"
              value={Number(field.value)}
              onChange={(e) => field.onChange(Number(e.target.value))}
            />
          </label>
        )}
      </Control>

      <button type="submit">Save</button>
    </Form>
  );
};

describe("form composition", () => {
  it("submits validated values when fields are filled", async () => {
    const onSubmit = vi.fn<(values: Values) => void>();
    const user = userEvent.setup();
    render(<Harness onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Label"), "Primary");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      label: "Primary",
      swatch: { l: 0.5 }
    });
  });

  it("blocks submit and surfaces the Valibot message on invalid input", async () => {
    const onSubmit = vi.fn<(values: Values) => void>();
    const user = userEvent.setup();
    render(<Harness onSubmit={onSubmit} />);

    // Leave the required label empty.
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Label is required")
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("flows custom-Control edits back into the submitted value", async () => {
    const onSubmit = vi.fn<(values: Values) => void>();
    const user = userEvent.setup();
    render(<Harness onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Label"), "Primary");
    const lightness = screen.getByLabelText("lightness");
    await user.clear(lightness);
    await user.type(lightness, "0.8");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].swatch.l).toBe(0.8);
  });
});
