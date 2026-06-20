/**
 * Export panel (Phase 7, SPEC §2.13): pick a format (DTCG JSON or `@saeris/colors`
 * CSS variables), preview the output, and copy it. The transforms are pure
 * ({@link exportTokens}); this is the thin UI around them. The preview `<textarea>`
 * is always selectable, so the user can copy manually if the programmatic clipboard
 * is blocked inside the plugin iframe.
 */

import { type JSX, useMemo, useState } from "react";
import type { TokenTree } from "../tokens/index.js";
import { Button } from "../components/Button.js";
import { type ExportFormat, exportTokens } from "./transforms.js";
import "./ExportPanel.css";

export interface ExportPanelProps {
  tree: TokenTree;
}

const FORMATS: Array<{ value: ExportFormat; label: string }> = [
  { value: "css", label: "CSS variables" },
  { value: "dtcg", label: "DTCG JSON" }
];

const isExportFormat = (value: string): value is ExportFormat =>
  FORMATS.some((f) => f.value === value);

export const ExportPanel = ({ tree }: ExportPanelProps): JSX.Element => {
  const [format, setFormat] = useState<ExportFormat>("css");
  const [copied, setCopied] = useState(false);

  const output = useMemo(() => exportTokens(tree, format), [tree, format]);

  const onCopy = (): void => {
    void (async (): Promise<void> => {
      try {
        await navigator.clipboard.writeText(output);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        // Clipboard blocked in the iframe — the preview is selectable for manual copy.
        setCopied(false);
      }
    })();
  };

  return (
    <div className="export-panel">
      <div className="export-panel__controls">
        <label className="export-panel__format">
          <span>Format</span>
          <select
            value={format}
            onChange={(e) => {
              if (isExportFormat(e.target.value)) setFormat(e.target.value);
            }}
          >
            {FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <Button variant="brand" onClick={onCopy}>
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>

      <textarea
        className="export-panel__preview"
        aria-label="Export preview"
        readOnly
        value={output}
        rows={10}
      />
    </div>
  );
};
