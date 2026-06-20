/**
 * Contrast display (Phase 5, SPEC §2.5/§2.6): shows the accessibility of a text /
 * background okLCH pair both ways — APCA (the signed Lc, with its readability tier
 * and a typography pass/fail) and WCAG 2.x (the symmetric ratio against AA
 * thresholds). The two are shown side by side, clearly labeled, never blended.
 *
 * APCA order matters (text vs. background — polarity is meaningful); WCAG order does
 * not. The font-lookup verdict uses |Lc| against the chosen size/weight (SPEC §2.5).
 */

import type { JSX } from "react";
import {
  apca,
  contrastTier,
  type Oklch,
  passesAPCA,
  wcag21
} from "../color/index.js";
import "./ContrastDisplay.css";

export interface ContrastDisplayProps {
  /** Foreground (text) color — APCA polarity depends on this being the text. */
  text: Oklch;
  /** Background color. */
  background: Oklch;
  /** Typography context for the APCA pass/fail (defaults to 16px / 400). */
  fontSizePx?: number;
  fontWeight?: number;
}

/** Human labels for each APCA readability tier. */
const TIER_LABEL: Record<ReturnType<typeof contrastTier>, string> = {
  fluent: "Fluent text",
  body: "Body text",
  content: "Content text",
  large: "Large text",
  nonText: "Non-text",
  minimum: "Minimum",
  insufficient: "Insufficient"
};

/** WCAG 2.x AA: 4.5:1 for normal text, 3:1 for large (≥18.66px, or ≥24px regular). */
const wcagAA = (ratio: number, sizePx: number, weight: number): boolean => {
  const isLarge = sizePx >= 24 || (sizePx >= 18.66 && weight >= 700);
  return ratio >= (isLarge ? 3 : 4.5);
};

export const ContrastDisplay = ({
  text,
  background,
  fontSizePx = 16,
  fontWeight = 400
}: ContrastDisplayProps): JSX.Element => {
  const lc = apca(text, background);
  const ratio = wcag21(text, background);
  const tier = contrastTier(lc);
  const apcaPass = passesAPCA(lc, fontSizePx, fontWeight);
  const wcagPass = wcagAA(ratio, fontSizePx, fontWeight);

  return (
    <div className="contrast-display">
      <div className="contrast-display__metric">
        <span className="contrast-display__label">APCA</span>
        <span className="contrast-display__value">{Math.round(lc)} Lc</span>
        <span className="contrast-display__tier">{TIER_LABEL[tier]}</span>
        <span
          className={`contrast-display__verdict contrast-display__verdict--${apcaPass ? "pass" : "fail"}`}
          role="status"
        >
          {apcaPass ? "Pass" : "Fail"} · {fontSizePx}px / {fontWeight}
        </span>
      </div>

      <div className="contrast-display__metric">
        <span className="contrast-display__label">WCAG 2</span>
        <span className="contrast-display__value">{ratio.toFixed(2)}:1</span>
        <span
          className={`contrast-display__verdict contrast-display__verdict--${wcagPass ? "pass" : "fail"}`}
          role="status"
        >
          {wcagPass ? "Pass AA" : "Fail AA"}
        </span>
      </div>
    </div>
  );
};
