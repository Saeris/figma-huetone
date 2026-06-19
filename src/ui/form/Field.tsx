/**
 * `Field` and `FieldError` (SPEC §2.11) — the native-input half of the composition layer. `Field` binds a standard `<input>` to the ambient form by a typed `name` (via RHF's `register`); `FieldError` shows that field's validation message. Both read the form from context, so composing a form is just nesting these with typed `name`s — no prop-drilling of `value`/`onChange`/`error`.
 *
 * For custom (non-native) controls like okLCH sliders, use `Control` instead.
 */

import type { InputHTMLAttributes, JSX } from "react";
import { get } from "react-hook-form";
import type { FieldValues, Path } from "react-hook-form";
import { useFormScope } from "./Form.js";
import { toName } from "./names.js";

export interface FieldProps<T extends FieldValues> extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "name"
> {
  /** Typed field path — pass `form.names.x` (coerces) or a literal `Path<T>`. */
  name: Path<T>;
}

/** A native `<input>` registered to the ambient form field at `name`. */
export const Field = <T extends FieldValues>({
  name,
  ...inputProps
}: FieldProps<T>): JSX.Element => {
  const { register } = useFormScope<T>();
  return <input {...register(toName<T>(name))} {...inputProps} />;
};

export interface FieldErrorProps<T extends FieldValues> {
  /** The field whose error to show — same typed `name` as the bound control. */
  name: Path<T>;
}

/**
 * Render the validation message for the field at `name`, or nothing if it's valid. Reads `formState.errors` from context by path.
 */
export const FieldError = <T extends FieldValues>({
  name
}: FieldErrorProps<T>): JSX.Element | null => {
  const {
    formState: { errors }
  } = useFormScope<T>();
  // RHF nests errors by path; `get` walks the dotted path (returns `any`), so we runtime-check the message rather than asserting its type.
  const message: unknown = get(errors, toName<T>(name))?.message;
  return typeof message === "string" ? (
    <span role="alert" className="fk-field-error">
      {message}
    </span>
  ) : null;
};
