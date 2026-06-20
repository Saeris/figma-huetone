/**
 * The swatch editor (Phase 2 + 4): okLCH editing for the selected swatch. Built on
 * the form utils (RHF + Valibot + the typed `names` proxy — SPEC §2.11): a Valibot
 * schema defines the okLCH value shape and bounds, and editing a channel derives the
 * gamut-mapped RGBA + okLCH source and fires `onEdit`, which the parent persists via
 * `editToken`.
 *
 * Phase 4 adds the **dual control** (SPEC §2.10): each of L/C/H gets a Lightroom-
 * style {@link ChannelSlider} (precise drag/keyboard + number entry) layered over a
 * {@link ChannelHistogram} (its valid-gamut band + sibling-ramp ticks). Alpha stays
 * a plain number field. The sliders write back into RHF via `setValue`, so all the
 * Phase 2 validation + live persistence still applies.
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
import { Field, Form, toName, useTypedForm } from "../form/index.js";
import type { Channel } from "./channel.js";
import { ChannelHistogram } from "./ChannelHistogram.js";
import { ChannelSlider } from "./ChannelSlider.js";
import type { SwatchVM } from "./model.js";
import "./SwatchEditor.css";

/** Sibling values per channel (the rest of the ramp) for the histogram ticks. */
export interface ChannelSiblings {
  l: number[];
  c: number[];
  h: number[];
}

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
  /** Sibling ramp values per channel, for the histogram relationship ticks. */
  siblings: ChannelSiblings;
  /** Persist an okLCH edit for this swatch (parent calls `editToken`). */
  onEdit: (path: string[], color: Oklch) => void;
}

/** The three slider channels and their display labels, in editor order. */
const SLIDER_CHANNELS: Array<{ channel: Channel; label: string }> = [
  { channel: "l", label: "L" },
  { channel: "c", label: "C" },
  { channel: "h", label: "H" }
];

export const SwatchEditor = ({
  swatch,
  gamut,
  siblings,
  onEdit
}: SwatchEditorProps): JSX.Element => {
  const form = useTypedForm<OklchValues>({
    resolver: valibotResolver(OklchForm),
    values: toValues(swatch.oklch),
    mode: "onChange"
  });

  // Live-apply edits: subscribe to value changes and persist the ones that pass
  // validation. We can't rely on the watch event's `type` to tell a user edit from
  // the programmatic `values` re-sync, because `setValue` (the sliders) also fires
  // without a `type`. Instead we compare the watched values against the swatch we
  // loaded — only a genuine difference is a user edit worth persisting. This also
  // makes the re-sync on selecting a new swatch a no-op (values == swatch.oklch).
  const { watch, getValues, trigger } = form;
  const pathKey = swatch.path.join("/");
  useEffect(() => {
    const base = toValues(swatch.oklch);
    const sub = watch((value): void => {
      const changed =
        value.l !== base.l ||
        value.c !== base.c ||
        value.h !== base.h ||
        value.alpha !== base.alpha;
      if (!changed) return;
      void (async (): Promise<void> => {
        if (await trigger()) onEdit(swatch.path, getValues());
      })();
    });
    return (): void => sub.unsubscribe();
  }, [watch, getValues, trigger, onEdit, swatch.oklch, swatch.path, pathKey]);

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

      <div className="swatch-editor__sliders">
        {SLIDER_CHANNELS.map(({ channel, label }) => (
          <ChannelSlider
            key={channel}
            channel={channel}
            label={label}
            value={preview[channel]}
            // Write into RHF; `shouldValidate`/`shouldDirty` mark it a user change so
            // the watch subscription persists it (and the preview re-renders).
            onChange={(value) =>
              form.setValue(toName<OklchValues>(form.names[channel]), value, {
                shouldValidate: true,
                shouldDirty: true,
                shouldTouch: true
              })
            }
          >
            <ChannelHistogram
              color={preview}
              channel={channel}
              gamut={gamut}
              siblings={siblings[channel]}
            />
          </ChannelSlider>
        ))}

        <label className="swatch-editor__alpha">
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
