/**
 * The typed `names` proxy (SPEC §2.11) — the load-bearing form-utils DX, ported
 * from Ariakit's `form.names` onto React Hook Form.
 *
 * Problem it solves: wiring a field with a bare string — `name="swatch.l"` — is a
 * silent footgun. Rename the schema key and the string drifts out of sync with no
 * error; the field detaches and the bug is invisible until runtime. We want
 * `name={form.names.swatch.l}` to be **type-checked** against the form's value
 * shape and to participate in VSCode "rename symbol", so a schema change cascades.
 *
 * Mechanism: `names` is a `Proxy` whose static TYPE is a mapped type over the value
 * shape (each access narrows to the corresponding dotted `Path`), and whose RUNTIME
 * is path-string accumulation — `names.swatch.l` coerces to the string `"swatch.l"`,
 * `names.scales[0].name` to `"scales.0.name"` (RHF's dot-index convention). The
 * value type is the single source of truth (in this project, a Valibot schema's
 * inferred output), so the proxy can't reference a field the type doesn't have.
 */

import type { FieldValues, Path } from "react-hook-form";

/**
 * The proxy's type: every property access mirrors the value shape, and any node
 * coerces to its dotted `Path<T>` string. Leaves and intermediate nodes alike are
 * usable as a `name` (an intermediate path addresses a nested field group).
 *
 * Each node is the branded path string intersected with a mapped type of its
 * children, so `names.swatch` is usable as `"swatch"` AND `names.swatch.l` resolves
 * to `"swatch.l"`. Arrays expose numeric indexing.
 */
export type FieldNames<T> = FieldNamesAt<T, "">;

/** `FieldNames` for the subtree at accumulated path prefix `P` (`""` at the root). */
type FieldNamesAt<T, P extends string> = {
  readonly [K in keyof T & string]: FieldNamesNode<T[K], Join<P, K>>;
};

/**
 * A node at path `P` over value `V`. Every node IS its literal path string `P`
 * (so `names.swatch.l` is typed as `"swatch.l"`, assignable to RHF's `Path<T>`),
 * intersected with its children so access can continue.
 */
type FieldNamesNode<V, P extends string> =
  // Primitives / leaves: the node is exactly its path literal.
  V extends string | number | boolean | bigint | symbol | null | undefined
    ? P
    : V extends ReadonlyArray<infer E>
      ? P & {
          readonly [index: number]: FieldNamesNode<E, Join<P, `${number}`>>;
        }
      : V extends object
        ? P & FieldNamesAt<V, P>
        : P;

/** Append a segment to a dotted path (no leading dot at the root). */
type Join<P extends string, K extends string> = P extends "" ? K : `${P}.${K}`;

const PATH = Symbol("path");

interface PathCarrier {
  [PATH]: string;
}

const makeNode = (path: string): PathCarrier => {
  // The target is a function so the proxy can be both indexed and string-coerced;
  // its identity doesn't matter — every trap is handled below.
  const target: PathCarrier = Object.assign((): undefined => undefined, {
    [PATH]: path
  });
  return new Proxy(target, {
    get(t, prop, receiver): unknown {
      if (prop === PATH) return path;
      // String coercion (`String(node)`, template literals, RHF reading it as a
      // name) resolves to the accumulated dotted path.
      if (
        prop === Symbol.toPrimitive ||
        prop === "toString" ||
        prop === "valueOf"
      ) {
        return (): string => path;
      }
      if (typeof prop === "symbol") {
        return Reflect.get(t, prop, receiver) as unknown;
      }
      // Property/index access extends the path (RHF dot-index convention).
      const next = path ? `${path}.${prop}` : prop;
      return makeNode(next);
    }
  });
};

/**
 * Build the typed `names` proxy for a form value type `T`. Access mirrors the value
 * shape; any node stringifies to its dotted path. Pair with {@link toName} (or just
 * pass a node straight to a `name` prop — it coerces).
 *
 * ```ts
 * const names = createNames<{ swatch: { l: number } }>();
 * names.swatch.l // typed; coerces to "swatch.l"
 * ```
 */
export const createNames = <T extends FieldValues>(): FieldNames<T> =>
  // The proxy's runtime is path strings; its type is the mapped FieldNames<T>. This
  // is the one assertion seam between the dynamic proxy and the static field map.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- proxy seam: runtime is path-string accumulation, type is the mapped field-name tree derived from the value shape.
  makeNode("") as unknown as FieldNames<T>;

/**
 * Resolve a `names` node OR a plain string to its dotted path as a typed `Path<T>`.
 * Field components call this to hand RHF a real string — RHF uses `name` as an
 * object key and in internal lookups, so it must not receive the live proxy.
 *
 * Accepts a literal `Path<T>` too (returns it unchanged), so call sites can pass
 * either `form.names.x` or a string literal.
 */
export const toName = <T extends FieldValues>(node: Path<T>): Path<T> => {
  // A `names` node is a Proxy that string-coerces to its path; a literal is already
  // a string. Coercing handles both — and the Proxy's own `[PATH]` is consulted via
  // its `Symbol.toPrimitive`/`toString` trap.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- proxy seam (see createNames): the runtime value is a path string (literal or proxy-coerced).
  return `${node}` as Path<T>;
};
