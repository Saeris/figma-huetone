/**
 * Tests for the typed `names` proxy (SPEC §2.11). The proxy's VALUE is the dotted field path; its TYPE is checked against the form's value shape. These assert the runtime path accumulation (what RHF actually receives as a `name`), since the type-level guarantee is enforced by the compiler at call sites.
 *
 * Why it matters: a wrong path string silently detaches a field. The proxy exists so that can't happen — `names.swatch.l` is both type-checked and coerces to the exact string RHF expects, and a schema rename cascades via VSCode "rename symbol".
 */

import { describe, expect, it } from "vitest";
import { createNames, toName } from "./names.js";

interface Sample {
  name: string;
  swatch: { l: number; c: number; h: number };
  scales: { name: string; step: number }[];
}

// `toName` is the canonical way to read a node's runtime path string (the nodes are Proxies; their static type is the literal path). Used throughout instead of `String(...)`, which the type checker — correctly seeing the literal-string type — would flag as a redundant conversion.
describe("names proxy path accumulation", () => {
  it("resolves a top-level field to its own name", () => {
    const names = createNames<Sample>();
    expect(toName<Sample>(names.name)).toBe("name");
  });

  it("resolves nested fields to a dotted path", () => {
    const names = createNames<Sample>();
    expect(toName<Sample>(names.swatch.l)).toBe("swatch.l");
    expect(toName<Sample>(names.swatch.h)).toBe("swatch.h");
  });

  it("exposes the intermediate group path too", () => {
    // An intermediate node is itself a usable name (addresses the field group).
    const names = createNames<Sample>();
    expect(toName<Sample>(names.swatch)).toBe("swatch");
  });

  it("resolves array indices with RHF's dot-index convention", () => {
    const names = createNames<Sample>();
    expect(toName<Sample>(names.scales[0].name)).toBe("scales.0.name");
    expect(toName<Sample>(names.scales[2].step)).toBe("scales.2.step");
  });

  it("coerces in template literals", () => {
    const names = createNames<Sample>();
    // The node's static type is the literal `"swatch.c"`, so the linter thinks the
    // template wrapper is redundant — but at runtime the node is a Proxy, and this
    // asserts the template-literal coercion path (distinct from `toName`) works.
    // oxlint-disable-next-line typescript/no-unnecessary-template-expression -- runtime value is a Proxy; the template tests its string coercion.
    const coerced = `${names.swatch.c}`;
    expect(coerced).toBe("swatch.c");
  });

  it("returns a fresh node per access (no shared mutable path state)", () => {
    // Accumulation must not leak between sibling accesses.
    const names = createNames<Sample>();
    const l = toName<Sample>(names.swatch.l);
    const c = toName<Sample>(names.swatch.c);
    expect(l).toBe("swatch.l");
    expect(c).toBe("swatch.c");
  });
});
