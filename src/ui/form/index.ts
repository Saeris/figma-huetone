/**
 * Form utilities (SPEC §2.11): RHF + Valibot with Ariakit-style composition — a
 * context `Form`, fields that attach by a typed `name`, and the `names` proxy that
 * makes those names type-checked and rename-safe. Ariakit is the DX reference; the
 * only runtime dependency is React Hook Form.
 */

export { createNames, type FieldNames, toName } from "./names.js";
export {
  Form,
  type FormProps,
  type TypedForm,
  useFormScope,
  useTypedForm
} from "./Form.js";
export { Control, type ControlProps } from "./Control.js";
export {
  Field,
  FieldError,
  type FieldErrorProps,
  type FieldProps
} from "./Field.js";
