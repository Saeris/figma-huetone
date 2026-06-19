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
const driver = (requestName: string): string => `
  globalThis.__html__ = "<html></html>";
  let __messageHandler;
  const __posted = [];
  globalThis.figma = {
    showUI: () => {},
    closePlugin: () => {},
    root: { documentColorProfile: "DISPLAY_P3" },
    ui: {
      postMessage: (msg) => { __posted.push(msg); },
      on: (_type, cb) => { __messageHandler = cb; },
      off: () => {}
    },
    variables: {
      getLocalVariableCollectionsAsync: () => Promise.resolve([]),
      getVariableCollectionByIdAsync: () => Promise.resolve(null),
      getVariableByIdAsync: () => Promise.resolve(null),
      createVariableCollection: (name) => ({
        id: "col-1", name, defaultModeId: "m", variableIds: [],
        getPluginData: () => "", setPluginData: () => {}
      }),
      createVariable: () => ({})
    }
  };

  // The bundle runs here, registering its message handler via figma.ui.on(...).
  ${bundle}

  // Drive a UI→sandbox request through the bundle's handler.
  __messageHandler({ kind: "request", id: 1, name: ${JSON.stringify(requestName)}, input: undefined });

  // Surface what showUI/the handler produced. The reply is posted asynchronously (handlers are async), so the host flushes pending jobs before reading this.
  globalThis.__readResult = () => JSON.stringify({
    booted: typeof __messageHandler === "function",
    reply: __posted.find((m) => m && m.kind === "response" && m.id === 1) ?? null
  });
`;

const runInQuickJS = async (requestName: string): Promise<unknown> => {
  const QuickJS = await getQuickJS();
  const vm: QuickJSContext = QuickJS.newContext();
  try {
    const load = vm.evalCode(driver(requestName));
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
    const result = (await runInQuickJS("getColorProfile")) as {
      booted: boolean;
    };
    // If the bundle used an engine feature QuickJS lacks, the load would have thrown above. Reaching here with a registered handler proves it booted.
    expect(result.booted).toBe(true);
  });

  it("round-trips a real procedure (getColorProfile) through the bridge", async () => {
    const result = (await runInQuickJS("getColorProfile")) as {
      reply: { ok: boolean; output: { profile: string } } | null;
    };
    // The bundle's getColorProfile handler read our mock figma.root and replied over the bridge — exercising the typed contract under the real engine.
    expect(result.reply?.ok).toBe(true);
    expect(result.reply?.output).toEqual({ profile: "DISPLAY_P3" });
  });
});
