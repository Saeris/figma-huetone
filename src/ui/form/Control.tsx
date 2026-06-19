/**
 * `Control` — the abstract field control (SPEC §2.11), modeled on Ariakit's
 * `FormControl`. It does NOT assume a native `value`/`onChange` element, so it wraps
 * custom controls whose value isn't a DOM input value — notably our `useMove`-based
 * okLCH sliders (Phase 4). It binds to the ambient form by a typed `name` via RHF's
 * `useController`, and hands the field state to a render prop.
 *
 * For plain native inputs prefer `Field` (sibling module); reach for `Control` when
 * the control is custom.
 */

import type { JSX, ReactNode } from "react";
import {
  type ControllerFieldState,
  type ControllerRenderProps,
  type FieldValues,
  type Path,
  useController
} from "react-hook-form";
import { useFormScope } from "./Form.js";
import { toName } from "./names.js";

export interface ControlProps<T extends FieldValues> {
  /**
   * The field path. Pass a `names` node (`form.names.swatch.l`) — it's typed and
   * coerces to the path string — or a literal `Path<T>`.
   */
  name: Path<T>;
  /** Render the control from the bound field state (value, onChange, error, …). */
  children: (field: {
    field: ControllerRenderProps<T, Path<T>>;
    fieldState: ControllerFieldState;
  }) => ReactNode;
}

/**
 * Bind a custom control to the ambient form field at `name` and render it via the
 * child function. Re-renders only when that field's state changes (RHF subscribes
 * by name), so unrelated edits don't re-render this control.
 */
export const Control = <T extends FieldValues>({
  name,
  children
}: ControlProps<T>): JSX.Element => {
  const { control } = useFormScope<T>();
  // `name` may be a `names` proxy node; RHF needs a real string.
  const { field, fieldState } = useController<T>({
    name: toName<T>(name),
    control
  });
  return <>{children({ field, fieldState })}</>;
};
