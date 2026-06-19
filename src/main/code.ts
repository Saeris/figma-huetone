/**
 * Main thread (sandbox) entry — runs in Figma's QuickJS sandbox with the `figma` global but no DOM. It opens the UI, then registers typed handlers for the persistence procedures the UI `call`s and pushes `tokensChanged` events.
 *
 * This is the sandbox half of Phase 1's persistence spine (SPEC §5). All color math lives in the UI; here we only read/write Figma Variables via `src/main/palette.ts` and shuttle plain DTCG JSON across the bridge.
 */

import { createMainBridge } from "../ipc/channel.main.js";
import { installDisposeShim } from "../ipc/disposable.js";
import { applyEdit, ensurePaletteCollection, readTokens } from "./palette.js";

// Seed `Symbol.dispose` before any `using` runs (the sandbox is ES2020 and may lack it). No-op where it already exists.
installDisposeShim();

// Open the UI. `themeColors: true` injects Figma's `--figma-color-*` variables so the UI matches the user's light/dark theme. `__html__` is the bundled ui.html.
figma.showUI(__html__, { themeColors: true, width: 480, height: 600 });

const bridge = createMainBridge(figma.ui);

// The managed collection, resolved lazily on first use and cached. Tokens always read/write through this so reads and edits agree on the same collection.
let collectionId: string | undefined;

const resolveCollection = async (
  name = "Huetone Base"
): Promise<VariableCollection> => {
  const collection = collectionId
    ? await figma.variables.getVariableCollectionByIdAsync(collectionId)
    : null;
  if (collection) return collection;
  const ensured = await ensurePaletteCollection(name);
  collectionId = ensured.id;
  return ensured;
};

// --- Procedure handlers: answer the UI's typed `call`s ---

bridge.handle("ensurePaletteCollection", async ({ name }) => {
  const collection = await resolveCollection(name);
  return { collectionId: collection.id };
});

bridge.handle("getColorProfile", () => ({
  profile: figma.root.documentColorProfile
}));

bridge.handle("readTokens", async () => {
  const collection = await resolveCollection();
  return { tree: await readTokens(collection) };
});

bridge.handle("editToken", async (edit) => {
  const collection = await resolveCollection();
  await applyEdit(collection, edit);
  return { tree: await readTokens(collection) };
});

bridge.handle("close", (input) => {
  figma.closePlugin(input?.notify);
});
