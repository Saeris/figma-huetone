/**
 * Tests the sandbox-side Figma ↔ DTCG mapping (`palette.ts`) against an in-memory fake of the Figma Variables API. This is Phase 1's load-bearing test: it proves the persistence spine end to end, especially the property the whole plugin exists for —
 *
 *   **okLCH survives the round-trip through Figma losslessly**, because we persist the canonical `oklch()` string in code syntax and read it back, rather than re-deriving it from the lossy RGBA value (SPEC §2.7).
 *
 * The fake models only what `palette.ts` touches: collections with a plugin-data marker + default mode, and color variables with `valuesByMode`, `codeSyntax`, `setValueForMode`, `setVariableCodeSyntax`. No real Figma, no DOM — pure Node.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  formatOklch,
  type Oklch,
  parseOklch,
  toRgb
} from "../ui/color/index.js";
import { isColorToken, type TokenGroup } from "../ipc/tokens.js";
import {
  applyEdit,
  ensurePaletteCollection,
  readTokens,
  removeGroup,
  removeScale,
  renameGroup,
  renameScale
} from "./palette.js";

// --- minimal in-memory Figma fake ---

interface FakeVariable {
  id: string;
  name: string;
  resolvedType: "COLOR";
  valuesByMode: Record<string, RGBA>;
  codeSyntax: { WEB?: string };
  setValueForMode: (modeId: string, value: RGBA) => void;
  setVariableCodeSyntax: (platform: "WEB", value: string) => void;
  remove: () => void;
}

interface FakeCollection {
  id: string;
  name: string;
  defaultModeId: string;
  variableIds: string[];
  pluginData: Record<string, string>;
  getPluginData: (key: string) => string;
  setPluginData: (key: string, value: string) => void;
}

interface FakeFigma {
  root: { readonly documentColorProfile: string };
  variables: {
    getLocalVariableCollectionsAsync: () => Promise<FakeCollection[]>;
    getVariableCollectionByIdAsync: (
      id: string
    ) => Promise<FakeCollection | null>;
    getVariableByIdAsync: (id: string) => Promise<FakeVariable | null>;
    createVariableCollection: (name: string) => FakeCollection;
    createVariable: (
      name: string,
      collection: FakeCollection,
      type: "COLOR"
    ) => FakeVariable;
  };
}

let fake: FakeFigma;

const installFigmaFake = (): { profile: "SRGB" | "DISPLAY_P3" } => {
  const variables = new Map<string, FakeVariable>();
  const collections = new Map<string, FakeCollection>();
  let counter = 0;
  const state = { profile: "SRGB" as "SRGB" | "DISPLAY_P3" };

  const figma: FakeFigma = {
    root: {
      get documentColorProfile(): string {
        return state.profile;
      }
    },
    variables: {
      getLocalVariableCollectionsAsync: async (): Promise<FakeCollection[]> =>
        Promise.resolve([...collections.values()]),
      getVariableCollectionByIdAsync: async (
        id: string
      ): Promise<FakeCollection | null> =>
        Promise.resolve(collections.get(id) ?? null),
      getVariableByIdAsync: async (id: string): Promise<FakeVariable | null> =>
        Promise.resolve(variables.get(id) ?? null),
      createVariableCollection: (name: string): FakeCollection => {
        const id = `col-${++counter}`;
        const pluginData: Record<string, string> = {};
        const collection: FakeCollection = {
          id,
          name,
          defaultModeId: "mode-default",
          variableIds: [],
          pluginData,
          getPluginData: (key) => pluginData[key] ?? "",
          setPluginData: (key, value) => {
            pluginData[key] = value;
          }
        };
        collections.set(id, collection);
        return collection;
      },
      createVariable: (
        name: string,
        collection: FakeCollection,
        _type: "COLOR"
      ): FakeVariable => {
        const id = `var-${++counter}`;
        const variable: FakeVariable = {
          id,
          name,
          resolvedType: "COLOR",
          valuesByMode: {},
          codeSyntax: {},
          setValueForMode: (modeId, value) => {
            variable.valuesByMode[modeId] = value;
          },
          setVariableCodeSyntax: (_platform, value) => {
            variable.codeSyntax.WEB = value;
          },
          remove: () => {
            variables.delete(id);
            collection.variableIds = collection.variableIds.filter(
              (vid) => vid !== id
            );
          }
        };
        variables.set(id, variable);
        collection.variableIds.push(id);
        return variable;
      }
    }
  };

  // The module under test reads the `figma` global; install our fake.
  fake = figma;
  (globalThis as { figma?: unknown }).figma = figma;
  return state;
};

const uninstallFigmaFake = (): void => {
  delete (globalThis as { figma?: unknown }).figma;
};

// --- tests -------------------------------------------------------------------

describe("ensurePaletteCollection", () => {
  beforeEach(installFigmaFake);
  afterEach(uninstallFigmaFake);

  it("creates a marked collection when none exists, and reuses it", async () => {
    const first = await ensurePaletteCollection("Huetone Base");
    expect(first.getPluginData("huetone.managed")).toBe("1");

    // A second call finds it by marker, not name — no duplicate.

    const second = await ensurePaletteCollection("Renamed By User");
    expect(second.id).toBe(first.id);
  });

  it("ignores unmarked collections (e.g. the user's own)", async () => {
    // Simulate a pre-existing foreign collection with no marker.

    fake.variables.createVariableCollection("User Colors");
    const managed = await ensurePaletteCollection("Huetone Base");
    expect(managed.name).toBe("Huetone Base");
  });
});

describe("okLCH lossless round-trip through Figma", () => {
  beforeEach(installFigmaFake);
  afterEach(uninstallFigmaFake);

  it("recovers the EXACT okLCH source via code syntax, not the lossy RGBA", async () => {
    const collection = await ensurePaletteCollection("Huetone Base");
    const original: Oklch = { l: 0.627, c: 0.21, h: 25.4 };

    // UI side: derive the gamut-mapped render value + serialize the okLCH source.
    await applyEdit(collection, {
      path: ["red", "500"],
      rgba: toRgb(original, "srgb"),
      oklch: formatOklch(original)
    });

    // Sandbox read → DTCG tree; UI parses the okLCH back out of $extensions.

    const tree = await readTokens(collection);
    const red = tree.red as TokenGroup;
    const token = red["500"];
    if (!isColorToken(token)) throw new Error("expected a color token");

    const recovered = parseOklch(
      `oklch(${token.$extensions?.["io.saeris.huetone"]?.oklch.join(" ")})`
    );
    expect(recovered.l).toBeCloseTo(0.627, 10);
    expect(recovered.c).toBeCloseTo(0.21, 10);
    expect(recovered.h).toBeCloseTo(25.4, 10);
  });

  it("preserves okLCH intent even when the RGBA render value is gamut-clipped", async () => {
    const collection = await ensurePaletteCollection("Huetone Base");
    // Out-of-sRGB vivid green: $value gets clipped, $extensions keeps the intent.

    const vivid: Oklch = { l: 0.86, c: 0.29, h: 142 };

    await applyEdit(collection, {
      path: ["green", "500"],
      rgba: toRgb(vivid, "srgb"),
      oklch: formatOklch(vivid)
    });

    const tree = await readTokens(collection);
    const token = tree.green as TokenGroup;
    const leaf = token["500"];
    if (!isColorToken(leaf)) throw new Error("expected a color token");

    expect(leaf.$extensions?.["io.saeris.huetone"]?.oklch).toEqual([
      0.86, 0.29, 142
    ]);
  });

  it("nests variable names like red/500 into DTCG groups", async () => {
    const collection = await ensurePaletteCollection("Huetone Base");
    await applyEdit(collection, {
      path: ["red", "500"],
      rgba: { r: 1, g: 0, b: 0, a: 1 },
      oklch: "oklch(0.627 0.21 25.4)"
    });
    await applyEdit(collection, {
      path: ["red", "600"],
      rgba: { r: 0.8, g: 0, b: 0, a: 1 },
      oklch: "oklch(0.55 0.2 25.4)"
    });

    const tree = await readTokens(collection);
    const red = tree.red as TokenGroup;
    expect(Object.keys(red).sort()).toEqual(["500", "600"]);
  });

  it("re-uses (not duplicates) a variable when editing an existing path", async () => {
    const collection = await ensurePaletteCollection("Huetone Base");
    const edit = {
      path: ["red", "500"],
      rgba: { r: 1, g: 0, b: 0, a: 1 },
      oklch: "oklch(0.627 0.21 25.4)"
    };
    await applyEdit(collection, edit);
    await applyEdit(collection, { ...edit, oklch: "oklch(0.6 0.2 26)" });

    expect(collection.variableIds).toHaveLength(1);
    const tree = await readTokens(collection);
    const red = tree.red as TokenGroup;
    const token = red["500"];
    if (!isColorToken(token)) throw new Error("expected a color token");
    expect(token.$extensions?.["io.saeris.huetone"]?.oklch).toEqual([
      0.6, 0.2, 26
    ]);
  });
});

describe("axis operations", () => {
  beforeEach(installFigmaFake);
  afterEach(uninstallFigmaFake);

  const seed = async (): Promise<VariableCollection> => {
    const collection = await ensurePaletteCollection("Huetone Base");
    const write = async (path: string[]): Promise<void> =>
      applyEdit(collection, {
        path,
        rgba: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
        oklch: "oklch(0.6 0.1 200)"
      });
    await write(["red", "100"]);
    await write(["red", "500"]);
    await write(["blue", "100"]);
    await write(["blue", "500"]);
    return collection;
  };

  const groups = (tree: TokenGroup): string[] =>
    Object.keys(tree).filter((k) => !k.startsWith("$"));

  it("renames a group across all its scales", async () => {
    const collection = await seed();
    await renameGroup(collection, "red", "crimson");
    const tree = await readTokens(collection);
    expect(groups(tree).sort()).toEqual(["blue", "crimson"]);
    // The scales moved with the group.
    expect(Object.keys(tree.crimson as TokenGroup).sort()).toEqual([
      "100",
      "500"
    ]);
  });

  it("renames a scale step across all groups", async () => {
    const collection = await seed();
    await renameScale(collection, "500", "550");
    const tree = await readTokens(collection);
    expect(Object.keys(tree.red as TokenGroup).sort()).toEqual(["100", "550"]);
    expect(Object.keys(tree.blue as TokenGroup).sort()).toEqual(["100", "550"]);
  });

  it("removes a group and all its variables", async () => {
    const collection = await seed();
    await removeGroup(collection, "red");
    const tree = await readTokens(collection);
    expect(groups(tree)).toEqual(["blue"]);
    expect(collection.variableIds).toHaveLength(2); // only blue/100, blue/500
  });

  it("removes a scale step across all groups", async () => {
    const collection = await seed();
    await removeScale(collection, "100");
    const tree = await readTokens(collection);
    expect(Object.keys(tree.red as TokenGroup)).toEqual(["500"]);
    expect(Object.keys(tree.blue as TokenGroup)).toEqual(["500"]);
  });

  it("is a no-op when renaming a group that doesn't exist", async () => {
    const collection = await seed();
    await renameGroup(collection, "green", "lime");
    const tree = await readTokens(collection);
    expect(groups(tree).sort()).toEqual(["blue", "red"]);
  });
});
