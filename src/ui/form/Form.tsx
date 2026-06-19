/**
 * The context `Form` (SPEC §2.11): a composition layer over React Hook Form, with the typed {@link FieldNames} proxy. Ariakit-style ergonomics — fields attach by a typed `name` and read form state from context, not prop-drilling — backed by RHF + Valibot validation. Ariakit is the DX reference; we depend only on RHF.
 *
 * `useTypedForm` creates the RHF form plus its `names` proxy. `<Form>` provides that form to descendants; `Field`/`Control` (sibling modules) consume it from context.
 */

import {
  createContext,
  type FormHTMLAttributes,
  type JSX,
  type ReactNode,
  useContext,
  useMemo
} from "react";
import {
  type FieldValues,
  FormProvider,
  type SubmitHandler,
  useForm,
  type UseFormProps,
  type UseFormReturn,
  useFormContext
} from "react-hook-form";
import { createNames, type FieldNames } from "./names.js";

/** An RHF form augmented with the typed `names` proxy (SPEC §2.11). */
export interface TypedForm<T extends FieldValues> extends UseFormReturn<T> {
  /** Typed field-name proxy: `names.swatch.l` ⇒ the checked path `"swatch.l"`. */
  names: FieldNames<T>;
}

/**
 * Create a {@link TypedForm}: an RHF form plus its `names` proxy. Pass a Valibot resolver (its inferred output type is the form's value shape, and thus the source of truth for `names`). Thin wrapper over `useForm` so all RHF options pass through.
 */
export const useTypedForm = <T extends FieldValues>(
  options?: UseFormProps<T>
): TypedForm<T> => {
  const form = useForm<T>(options);
  // `names` is a stateless proxy; build it once per form instance.
  const names = useMemo(() => createNames<T>(), []);
  return useMemo(() => Object.assign(form, { names }), [form, names]);
};

// The proxy carries no runtime type, so context is over the loose base shape; the `useFormScope<T>()` hook below re-applies `T` at the consumer.
const NamesContext = createContext<FieldNames<FieldValues> | null>(null);

export interface FormProps<T extends FieldValues> extends Omit<
  FormHTMLAttributes<HTMLFormElement>,
  "onSubmit"
> {
  /** The form created by {@link useTypedForm}. */
  form: TypedForm<T>;
  /** Called with validated values when the form submits. */
  onSubmit?: SubmitHandler<T>;
  children: ReactNode;
}

/**
 * Provide a {@link TypedForm} to descendant `Field`/`Control` via context, and wire native submit through RHF's validating `handleSubmit`. Renders a `<form>`.
 */
export const Form = <T extends FieldValues>({
  form,
  onSubmit,
  children,
  ...formProps
}: FormProps<T>): JSX.Element => (
  <FormProvider {...form}>
    <NamesContext.Provider value={form.names as FieldNames<FieldValues>}>
      <form
        onSubmit={
          onSubmit
            ? (event): void => {
                // handleSubmit returns a promise; the DOM handler wants void.
                void form.handleSubmit(onSubmit)(event);
              }
            : undefined
        }
        {...formProps}
      >
        {children}
      </form>
    </NamesContext.Provider>
  </FormProvider>
);

/**
 * Read the ambient form + its `names` proxy from context, re-typed to `T`. The caller asserts `T` matches the enclosing `<Form>`'s value type (as in RHF's own `useFormContext<T>()`); there's no runtime type to check it against.
 */
export const useFormScope = <T extends FieldValues>(): TypedForm<T> => {
  const form = useFormContext<T>();
  const names = useContext(NamesContext);
  if (!names) {
    throw new Error("useFormScope must be used within a <Form>");
  }
  // The proxy is structurally identical across `T`; re-apply the caller's `T` (as RHF's own `useFormContext<T>()` does) — the one context-typing seam.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- context seam: the `names` proxy carries no runtime type; re-type to the caller's T (mirrors useFormContext<T>).
  return Object.assign(form, { names: names as FieldNames<T> });
};
