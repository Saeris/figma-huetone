/**
 * @vitest-environment jsdom
 *
 * Component tests for the dual color control (Phase 4, jsdom). These assert the
 * accessible behaviors that matter: the slider exposes ARIA slider semantics, arrow
 * keys step by the channel granularity and clamp at the domain edges, the paired
 * number input edits precisely, and the histogram renders a sibling tick per ramp
 * value. Pointer-drag (useMove) isn't exercised here — jsdom has no layout — but the
 * keyboard + number paths cover the value logic.
 */

import "@testing-library/jest-dom/vitest";
import { type JSX, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Oklch } from "../color/index.js";
import type { Channel } from "./channel.js";
import { ChannelHistogram } from "./ChannelHistogram.js";
import { ChannelSlider } from "./ChannelSlider.js";

/** A controlled wrapper so the slider's value updates like it does in production. */
const Controlled = ({
  channel,
  label,
  initial,
  onChange
}: {
  channel: Channel;
  label: string;
  initial: number;
  onChange: (value: number) => void;
}): JSX.Element => {
  const [value, setValue] = useState(initial);
  return (
    <ChannelSlider
      channel={channel}
      label={label}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
};

describe("channelSlider", () => {
  it("exposes ARIA slider semantics for the channel", () => {
    render(
      <ChannelSlider
        channel="l"
        label="L"
        value={0.5}
        onChange={vi.fn<(value: number) => void>()}
      />
    );
    const slider = screen.getByRole("slider", { name: "L" });
    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute("aria-valuemax", "1");
    expect(slider).toHaveAttribute("aria-valuenow", "0.5");
  });

  it("steps by the channel granularity on arrow keys", async () => {
    const onChange = vi.fn<(value: number) => void>();
    const user = userEvent.setup();
    render(
      <ChannelSlider channel="h" label="H" value={180} onChange={onChange} />
    );
    const slider = screen.getByRole("slider", { name: "H" });
    slider.focus();

    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith(181); // h step is 1
    await user.keyboard("{ArrowDown}");
    expect(onChange).toHaveBeenLastCalledWith(179);
  });

  it("clamps at the domain edge", async () => {
    const onChange = vi.fn<(value: number) => void>();
    const user = userEvent.setup();
    render(
      <ChannelSlider channel="l" label="L" value={1} onChange={onChange} />
    );
    screen.getByRole("slider", { name: "L" }).focus();
    await user.keyboard("{ArrowRight}");
    // Already at max — stays clamped.
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it("edits via the paired number input", async () => {
    const onChange = vi.fn<(value: number) => void>();
    const user = userEvent.setup();
    render(
      <Controlled channel="c" label="C" initial={0.1} onChange={onChange} />
    );
    const input = screen.getByLabelText("C value");
    await user.clear(input);
    await user.type(input, "0.2");
    expect(onChange).toHaveBeenLastCalledWith(0.2);
  });
});

describe("channelHistogram", () => {
  it("renders one relationship tick per sibling value", () => {
    const color: Oklch = { l: 0.6, c: 0.1, h: 25 };
    const { container } = render(
      <ChannelHistogram
        color={color}
        channel="l"
        gamut="srgb"
        siblings={[0.2, 0.5, 0.8]}
      />
    );
    expect(container.querySelectorAll(".channel-histogram__tick")).toHaveLength(
      3
    );
  });
});
