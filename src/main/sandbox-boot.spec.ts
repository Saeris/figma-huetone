/**
 * Sandbox bundle smoke-test in a REAL QuickJS engine (testing ladder tier 3 — see the project's plugin-testing notes). Our other sandbox tests run `palette.ts` functions in Node; this one loads the actual built `dist/code.js` into a QuickJS WASM VM — the same engine family Figma's sandbox uses — and drives a procedure through the bundle end to end.
 *
 * Why this exists: Node ≠ QuickJS. A bundle that passes Node tests can still fail in Figma if it relies on an engine feature QuickJS lacks, or if the build targets the wrong JS level. This test catches that whole class of "works in Node, breaks in Figma" bug against the real shipped artifact, without the flakiness of true E2E.
 *
 * The bundle is (re)built in `beforeAll` so the test always runs against current source. All message-passing is orchestrated INSIDE the VM (a mock `figma` + a driver appended after the bundle), so only a final JSON result crosses the WASM boundary.
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { getQuickJS, type QuickJSContext } from "quickjs-emscripten";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const CODE_JS = resolve(ROOT, "dist/code.js");

let bundle: string;

/**
 * A mock `figma` + a driver, evaluated in the VM AFTER the bundle. It records what the bundle does at load (showUI, the registered message handler), then injects a UI→sandbox request envelope and returns the captured reply — exercising the typed bridge and a real handler under QuickJS. `__result__` is read back across the boundary as JSON.
 */
const driver = (): string => `
  globalThis.__html__ = "<html></html>";
  let __messageHandler;
  const __posted = [];
  globalThis.figma = {
    showUI: () => {},
    closePlugin: () => {},
    on: () => {},
    currentPage: { selection: [], backgrounds: [] },
    root: { documentColorProfile: "DISPLAY_P3" },
    ui: {
      postMessage: (msg) => { __posted.push(msg); },
      on: (_type, cb) => { __messageHandler = cb; },
      off: () => {}
    },
    variables: (() => {
      // A small functional in-memory Variables store, so real handlers (not just
      // boot) run their full code path inside QuickJS — catching runtime bugs the
      // node-side palette tests can't (engine differences).
      const vars = new Map();
      const cols = new Map();
      let n = 0;
      const makeVar = (name, collection) => {
        const v = {
          id: "var-" + ++n, name, resolvedType: "COLOR",
          valuesByMode: {}, codeSyntax: {},
          setValueForMode: (mode, val) => { v.valuesByMode[mode] = val; },
          setVariableCodeSyntax: (_p, val) => { v.codeSyntax.WEB = val; },
          remove: () => { vars.delete(v.id); collection.variableIds = collection.variableIds.filter((i) => i !== v.id); }
        };
        vars.set(v.id, v);
        collection.variableIds.push(v.id);
        return v;
      };
      return {
        getLocalVariableCollectionsAsync: () => Promise.resolve([...cols.values()]),
        getVariableCollectionByIdAsync: (id) => Promise.resolve(cols.get(id) ?? null),
        getVariableByIdAsync: (id) => Promise.resolve(vars.get(id) ?? null),
        createVariableCollection: (name) => {
          const data = {};
          const c = {
            id: "col-" + ++n, name, defaultModeId: "m", variableIds: [],
            getPluginData: (k) => data[k] ?? "", setPluginData: (k, val) => { data[k] = val; }
          };
          cols.set(c.id, c);
          return c;
        },
        createVariable: (name, collection) => makeVar(name, collection)
      };
    })()
  };

  // The bundle runs here, registering its message handler via figma.ui.on(...).
  ${bundle}

  // Drive a sequence of UI→sandbox requests through the bundle's handler, so the
  // real procedure code paths execute under QuickJS.
  __messageHandler({ kind: "request", id: 1, name: "getColorProfile", input: undefined });
  __messageHandler({ kind: "request", id: 2, name: "ensurePaletteCollection", input: { name: "Huetone Base" } });
  __messageHandler({ kind: "request", id: 3, name: "editToken", input: { path: ["red", "500"], rgba: { r: 0.6, g: 0.1, b: 0.1, a: 1 }, oklch: "oklch(0.6 0.2 25)" } });

  globalThis.__readResult = () => JSON.stringify({
    booted: typeof __messageHandler === "function",
    profile: (__posted.find((m) => m && m.id === 1) || {}).output,
    collection: (__posted.find((m) => m && m.id === 2) || {}).output,
    edit: (__posted.find((m) => m && m.id === 3) || {})
  });
`;

const runInQuickJS = async (): Promise<unknown> => {
  const QuickJS = await getQuickJS();
  const vm: QuickJSContext = QuickJS.newContext();
  try {
    const load = vm.evalCode(driver());
    if (load.error) {
      const detail = vm.dump(load.error);
      load.error.dispose();
      throw new Error(
        `bundle failed to load in QuickJS: ${JSON.stringify(detail)}`
      );
    }
    load.value.dispose();

    // Async handlers resolve via the microtask queue; flush it so the reply posts.

    vm.runtime.executePendingJobs();

    const read = vm.evalCode("__readResult()");
    if (read.error) {
      const detail = vm.dump(read.error);
      read.error.dispose();
      throw new Error(`reading result failed: ${JSON.stringify(detail)}`);
    }
    const json = vm.dump(read.value) as string;
    read.value.dispose();
    return JSON.parse(json);
  } finally {
    vm.dispose();
  }
};

describe("dist/code.js boots and runs in QuickJS", () => {
  beforeAll(() => {
    // Build the sandbox bundle so we test current source, not a stale artifact. `execSync` with a command string uses the platform shell (so the `vp` PATH shim resolves on Windows too) without the deprecated `execFileSync`+`shell`.
    execSync("vp build --mode main", { cwd: ROOT, stdio: "ignore" });
    bundle = readFileSync(CODE_JS, "utf8");
  }, 60_000);

  it("loads the bundle without error and registers a message handler", async () => {
    const result = (await runInQuickJS()) as { booted: boolean };
    // If the bundle used an engine feature QuickJS lacks, the load would have thrown above. Reaching here with a registered handler proves it booted.
    expect(result.booted).toBe(true);
  });

  it("round-trips getColorProfile through the bridge", async () => {
    const result = (await runInQuickJS()) as { profile: { profile: string } };
    // The bundle's getColorProfile handler read our mock figma.root and replied over the bridge — exercising the typed contract under the real engine.
    expect(result.profile).toEqual({ profile: "DISPLAY_P3" });
  });

  it("runs ensurePaletteCollection + editToken end to end under QuickJS", async () => {
    // Drives the real write path (createVariable, setValueForMode,
    // setVariableCodeSyntax, re-read into a DTCG tree) inside the engine — the
    // sandbox-side counterpart to the browser E2E pass on the UI.
    const result = (await runInQuickJS()) as {
      collection: { collectionId: string };
      edit: {
        ok: boolean;
        output: { tree: Record<string, unknown> };
      };
    };
    expect(typeof result.collection.collectionId).toBe("string");
    expect(result.edit.ok).toBe(true);
    // The edited token round-tripped back into the DTCG tree with its okLCH source.
    const tree = result.edit.output.tree as {
      red?: { "500"?: { $extensions?: Record<string, { oklch: number[] }> } };
    };
    expect(
      tree.red?.["500"]?.$extensions?.["io.saeris.huetone"]?.oklch
    ).toEqual([0.6, 0.2, 25]);
  });
});
