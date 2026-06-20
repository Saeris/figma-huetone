/**
 * The per-channel valid-range visualization (Phase 4, SPEC §2.10) — the Huetone
 * histogram half of the dual control. It does two jobs at once:
 *
 * 1. shows the channel's **in-gamut band** — where along the channel's domain the
 *    color stays renderable (out-of-gamut stretches read as gaps), and
 * 2. shows this swatch's **relationship to its sibling ramp values** — tick marks at
 *    each sibling's position on the same channel, so you can see the ramp's spacing
 *    and keep it even.
 *
 * Rendered as a DOM overlay (CSS gradient + positioned ticks) rather than a canvas:
 * it's crisp, theme-aware, and testable in jsdom, and avoids the worker/canvas
 * complexity we deferred (SPEC §6.3). Slots into `ChannelSlider`'s `children` so it
 * sits behind the thumb.
 */

import { type JSX, useMemo } from "react";
import { type Gamut, formatOklch, type Oklch } from "../color/index.js";
import {
  type Channel,
  sampleChannel,
  toTrackPosition,
  withChannel
} from "./channel.js";
import "./ChannelHistogram.css";

export interface ChannelHistogramProps {
  /** The swatch being edited — the other two channels are held at its values. */
  color: Oklch;
  channel: Channel;
  gamut: Gamut;
  /** Sibling values on this channel (the rest of the ramp), for relationship ticks. */
  siblings: number[];
}

/**
 * Build a CSS `linear-gradient` across the channel domain: each sample shows the
 * color it would produce there, dimmed to transparent where out of gamut so invalid
 * stretches read as gaps against the track.
 */
const gradientFor = (
  color: Oklch,
  channel: Channel,
  gamut: Gamut,
  samples = 48
): string => {
  const stops = sampleChannel(color, channel, gamut, samples).map(
    (point, i) => {
      const pct = (i / (samples - 1)) * 100;
      const swatch = withChannel(color, channel, point.value);
      const css = point.inGamut ? formatOklch(swatch) : "transparent";
      return `${css} ${pct.toFixed(1)}%`;
    }
  );
  return `linear-gradient(to right, ${stops.join(", ")})`;
};

export const ChannelHistogram = ({
  color,
  channel,
  gamut,
  siblings
}: ChannelHistogramProps): JSX.Element => {
  const gradient = useMemo(
    () => gradientFor(color, channel, gamut),
    [color, channel, gamut]
  );

  return (
    <div className="channel-histogram" aria-hidden="true">
      <div
        className="channel-histogram__band"
        style={{ background: gradient }}
      />
      {siblings.map((value, i) => (
        <span
          key={`${value}-${i}`}
          className="channel-histogram__tick"
          style={{
            insetInlineStart: `${toTrackPosition(channel, value) * 100}%`
          }}
        />
      ))}
    </div>
  );
};
