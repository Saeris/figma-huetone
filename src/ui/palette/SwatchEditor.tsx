/**
 * The swatch editor (Phase 2): numeric okLCH editing for the selected swatch. Built
 * on the form utils (RHF + Valibot + the typed `names` proxy — SPEC §2.11): a
 * Valibot schema defines the okLCH value shape and bounds, and editing a channel
 * derives the gamut-mapped RGBA + okLCH source and fires `onEdit`, which the parent
 * persists via `editToken`. A live preview swatch and an out-of-gamut notice round
 * out the panel. The Lightroom-style sliders and the histogram chart arrive in
 * Phase 4; this is the precise-numeric half.
 */

import { type JSX, useEffect } from "react";
import { valibotResolver } from "@hookform/resolvers/valibot";
import * as v from "valibot";
import {
  formatOklch,
  type Gamut,
  inGamut,
  type Oklch
} from "../color/index.js";
import { Field, Form, useTypedForm } from "../form/index.js";
import type { SwatchVM } from "./model.js";
import "./SwatchEditor.css";

/** okLCH editing bounds (SPEC §2.9): L 0–1, C 0–0.5, H 0–360, alpha 0–1. */
const OklchForm = v.object({
  l: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  c: v.pipe(v.number(), v.minValue(0), v.maxValue(0.5)),
  h: v.pipe(v.number(), v.minValue(0), v.maxValue(360)),
  alpha: v.pipe(v.number(), v.minValue(0), v.maxValue(1))
});
type OklchValues = v.InferOutput<typeof OklchForm>;

const toValues = (c: Oklch): OklchValues => ({
  l: c.l,
  c: c.c,
  h: c.h,
  alpha: c.alpha ?? 1
});

export interface SwatchEditorProps {
  swatch: SwatchVM;
  gamut: Gamut;
  /** Persist an okLCH edit for this swatch (parent calls `editToken`). */
  onEdit: (path: string[], color: Oklch) => void;
}

export const SwatchEditor = ({
  swatch,
  gamut,
  onEdit
}: SwatchEditorProps): JSX.Element => {
  const form = useTypedForm<OklchValues>({
    resolver: valibotResolver(OklchForm),
    values: toValues(swatch.oklch),
    mode: "onChange"
  });

  // Live-apply edits: subscribe to value changes and persist the ones that pass
  // validation. RHF's `watch(callback)` fires only on actual changes (user input or
  // a `values` re-sync), and returns an unsubscribe. We persist by the swatch path
  // captured in the subscription, so a stale closure can't write to the wrong cell.
  const { watch, getValues, trigger } = form;
  const pathKey = swatch.path.join("/");
  useEffect(() => {
    const sub = watch((_value, { type }): void => {
      // `type` is set only for user-driven changes, not the programmatic `values`
      // re-sync that happens when a different swatch is selected. Validate, then
      // persist the fully-typed values (avoids the partial `value` arg).
      if (!type) return;
      void (async (): Promise<void> => {
        if (await trigger()) onEdit(swatch.path, getValues());
      })();
    });
    return (): void => sub.unsubscribe();
  }, [watch, getValues, trigger, onEdit, swatch.path, pathKey]);

  // Subscribing `watch()` (no callback) re-renders on every change, driving the live
  // preview + gamut notice. Falls back to the swatch's okLCH for any field RHF hasn't
  // populated yet on first render.
  const preview: Oklch = { ...swatch.oklch, ...watch() };
  const outOfGamut = !inGamut(preview, gamut);

  return (
    <Form form={form} className="swatch-editor">
      <header className="swatch-editor__header">
        <span
          className="swatch-editor__preview"
          style={{ background: formatOklch(preview) }}
          aria-hidden="true"
        />
        <span className="swatch-editor__title">
          {swatch.group} / {swatch.scale}
        </span>
      </header>

      <div className="swatch-editor__fields">
        <label className="swatch-editor__field">
          <span>L</span>
          <Field<OklchValues>
            name={form.names.l}
            type="number"
            step={0.001}
            min={0}
            max={1}
          />
        </label>
        <label className="swatch-editor__field">
          <span>C</span>
          <Field<OklchValues>
            name={form.names.c}
            type="number"
            step={0.001}
            min={0}
            max={0.5}
          />
        </label>
        <label className="swatch-editor__field">
          <span>H</span>
          <Field<OklchValues>
            name={form.names.h}
            type="number"
            step={0.1}
            min={0}
            max={360}
          />
        </label>
        <label className="swatch-editor__field">
          <span>A</span>
          <Field<OklchValues>
            name={form.names.alpha}
            type="number"
            step={0.01}
            min={0}
            max={1}
          />
        </label>
      </div>

      {outOfGamut ? (
        <p className="swatch-editor__warning" role="alert">
          Outside {gamut === "p3" ? "Display P3" : "sRGB"} — the rendered value
          is gamut-mapped.
        </p>
      ) : null}
    </Form>
  );
};
