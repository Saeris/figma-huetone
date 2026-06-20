/**
 * Per-channel okLCH model for the dual color control (Phase 4, SPEC §2.10). Pure
 * functions describing each channel's editable domain and its in-gamut band — the
 * data the sliders clamp against and the histograms shade. No React, no canvas.
 *
 * The "valid range" differs by channel: holding the other two fixed, ask which
 * values of this channel keep the color inside the active gamut. For chroma that's a
 * single ceiling (`maxChroma`); for lightness and hue it can be one or more bands,
 * so we sample the domain and report each sampled point's validity.
 */

import { type Gamut, inGamut, maxChroma, type Oklch } from "../color/index.js";

/** The three editable okLCH channels (alpha is a plain 0–1, handled separately). */
export type Channel = "l" | "c" | "h";

export interface ChannelDomain {
  min: number;
  max: number;
  /** Keyboard/step granularity for the slider. */
  step: number;
}

/** Editable domains per channel (SPEC §2.9): L 0–1, C 0–0.5, H 0–360. */
export const CHANNEL_DOMAIN: Record<Channel, ChannelDomain> = {
  l: { min: 0, max: 1, step: 0.005 },
  c: { min: 0, max: 0.5, step: 0.005 },
  h: { min: 0, max: 360, step: 1 }
};

/** Replace one channel of an okLCH color, keeping the rest. */
export const withChannel = (
  color: Oklch,
  channel: Channel,
  value: number
): Oklch => ({
  ...color,
  [channel]: value
});

/** Clamp a value into a channel's domain. */
export const clampChannel = (channel: Channel, value: number): number => {
  const { min, max } = CHANNEL_DOMAIN[channel];
  return Math.min(max, Math.max(min, value));
};

/**
 * The maximum in-gamut chroma for `color`'s current L/H — the hard ceiling the C
 * slider clamps to and the C histogram's valid edge. Thin wrapper over the color
 * module's {@link maxChroma}.
 */
export const chromaCeiling = (color: Oklch, gamut: Gamut): number =>
  maxChroma(color.l, color.h, gamut).c;

/**
 * Sample `channel` across its domain at `samples` evenly-spaced points, reporting
 * each point's value and whether `color` (with that channel substituted) is in
 * `gamut`. The histogram shades the in-gamut points; the slider can use it to mark
 * the valid band. The other two channels are held at `color`'s current values.
 */
export const sampleChannel = (
  color: Oklch,
  channel: Channel,
  gamut: Gamut,
  samples = 64
): Array<{ value: number; inGamut: boolean }> => {
  const { min, max } = CHANNEL_DOMAIN[channel];
  const span = max - min;
  return Array.from({ length: samples }, (_, i) => {
    const value = min + (span * i) / (samples - 1);
    return {
      value,
      inGamut: inGamut(withChannel(color, channel, value), gamut)
    };
  });
};

/** Normalize a channel value to a 0–1 track position (for slider/histogram layout). */
export const toTrackPosition = (channel: Channel, value: number): number => {
  const { min, max } = CHANNEL_DOMAIN[channel];
  return (value - min) / (max - min);
};

/** Inverse of {@link toTrackPosition}: a 0–1 track position back to a channel value. */
export const fromTrackPosition = (
  channel: Channel,
  position: number
): number => {
  const { min, max } = CHANNEL_DOMAIN[channel];
  return min + position * (max - min);
};
