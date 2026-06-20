/**
 * A single okLCH channel slider (Phase 4, SPEC §2.10) — the Lightroom-style precise
 * control. Built directly on React Aria's `useMove` (the accessible pointer+keyboard
 * drag primitive that `useColorSlider` itself uses) rather than React Aria's color
 * components, because their `Color` model can't carry okLCH. We hold okLCH state
 * ourselves and inherit the accessibility (ARIA slider semantics, keyboard, focus).
 *
 * `useMove` reports incremental deltas; we accumulate `deltaX` into the channel value
 * scaled by the track width, and handle arrow keys explicitly to step by the
 * channel's granularity. A paired number input gives exact entry. The histogram-style
 * valid-range visualization is a sibling component layered behind the track.
 */

import { type JSX, type KeyboardEvent, useRef } from "react";
import { useMove } from "react-aria";
import {
  type Channel,
  CHANNEL_DOMAIN,
  clampChannel,
  fromTrackPosition,
  toTrackPosition
} from "./channel.js";
import "./ChannelSlider.css";

export interface ChannelSliderProps {
  channel: Channel;
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Optional background for the track (e.g. a channel gradient). */
  trackBackground?: string;
  /** Optional histogram/overlay rendered behind the thumb (valid-range shading). */
  children?: JSX.Element;
}

export const ChannelSlider = ({
  channel,
  label,
  value,
  onChange,
  trackBackground,
  children
}: ChannelSliderProps): JSX.Element => {
  const trackRef = useRef<HTMLDivElement>(null);
  const { min, max, step } = CHANNEL_DOMAIN[channel];

  // useMove deltas are in pixels; convert to channel units via the track width.
  const { moveProps } = useMove({
    onMove(e) {
      const width = trackRef.current?.offsetWidth ?? 1;
      const span = max - min;
      onChange(clampChannel(channel, value + (e.deltaX / width) * span));
    }
  });

  const onKeyDown = (e: KeyboardEvent): void => {
    const delta =
      e.key === "ArrowLeft" || e.key === "ArrowDown"
        ? -step
        : e.key === "ArrowRight" || e.key === "ArrowUp"
          ? step
          : 0;
    if (delta === 0) return;
    e.preventDefault();
    onChange(clampChannel(channel, value + delta));
  };

  const position = toTrackPosition(channel, value);

  return (
    <div className="channel-slider">
      <span className="channel-slider__label">{label}</span>

      <div
        ref={trackRef}
        className="channel-slider__track"
        style={trackBackground ? { background: trackBackground } : undefined}
        // Clicking the track jumps the value to that position.
        onPointerDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pos = (e.clientX - rect.left) / rect.width;
          onChange(clampChannel(channel, fromTrackPosition(channel, pos)));
        }}
      >
        {children}
        <div
          {...moveProps}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          className="channel-slider__thumb"
          style={{ insetInlineStart: `${position * 100}%` }}
          onKeyDown={onKeyDown}
        />
      </div>

      <input
        type="number"
        className="channel-slider__input"
        aria-label={`${label} value`}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (!Number.isNaN(next)) onChange(clampChannel(channel, next));
        }}
      />
    </div>
  );
};
