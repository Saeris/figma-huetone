/**
 * Axis editor (Phase 3, SPEC §2.12): add / remove / rename the grid's color groups
 * (rows) and scale steps (columns). Edits project onto Figma variable names in the
 * sandbox (`red/500`), so renaming a group renames every `red/*` variable, etc.
 *
 * A thin, controlled component: it renders the current axes as editable chips and
 * fires callbacks; the parent (`App`) wires those to the bridge's axis procedures.
 * Arbitrary drag-reorder is deferred until palette-config order storage lands (SPEC
 * §6.5) — order is currently the view-model's numeric-aware default.
 */

import { type JSX, useState } from "react";
import { Button } from "../components/Button.js";
import "./AxisEditor.css";

export interface AxisEditorProps {
  groups: string[];
  scales: string[];
  onRenameGroup: (from: string, to: string) => void;
  onRemoveGroup: (name: string) => void;
  onAddGroup: (name: string) => void;
  onRenameScale: (from: string, to: string) => void;
  onRemoveScale: (scale: string) => void;
  onAddScale: (scale: string) => void;
}

/** One row of editable chips for an axis (groups or scales). */
const AxisRow = ({
  title,
  items,
  onRename,
  onRemove,
  onAdd,
  addPlaceholder
}: {
  title: string;
  items: string[];
  onRename: (from: string, to: string) => void;
  onRemove: (name: string) => void;
  onAdd: (name: string) => void;
  addPlaceholder: string;
}): JSX.Element => {
  const [adding, setAdding] = useState("");

  const commitAdd = (): void => {
    const name = adding.trim();
    if (name && !items.includes(name)) onAdd(name);
    setAdding("");
  };

  return (
    <div className="axis-editor__axis">
      <span className="axis-editor__axis-title">{title}</span>
      <ul className="axis-editor__chips">
        {items.map((item) => (
          <li key={item} className="axis-editor__chip">
            <input
              className="axis-editor__chip-input"
              aria-label={`Rename ${title} ${item}`}
              defaultValue={item}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next && next !== item && !items.includes(next)) {
                  onRename(item, next);
                } else {
                  e.target.value = item; // revert invalid/duplicate
                }
              }}
            />
            <button
              type="button"
              className="axis-editor__chip-remove"
              aria-label={`Remove ${title} ${item}`}
              onClick={() => onRemove(item)}
            >
              ×
            </button>
          </li>
        ))}
        <li className="axis-editor__add">
          <input
            className="axis-editor__chip-input"
            aria-label={`Add ${title}`}
            placeholder={addPlaceholder}
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitAdd();
            }}
          />
          <Button onClick={commitAdd} disabled={adding.trim() === ""}>
            Add
          </Button>
        </li>
      </ul>
    </div>
  );
};

export const AxisEditor = ({
  groups,
  scales,
  onRenameGroup,
  onRemoveGroup,
  onAddGroup,
  onRenameScale,
  onRemoveScale,
  onAddScale
}: AxisEditorProps): JSX.Element => (
  <div className="axis-editor">
    <AxisRow
      title="Group"
      items={groups}
      onRename={onRenameGroup}
      onRemove={onRemoveGroup}
      onAdd={onAddGroup}
      addPlaceholder="new color…"
    />
    <AxisRow
      title="Scale"
      items={scales}
      onRename={onRenameScale}
      onRemove={onRemoveScale}
      onAdd={onAddScale}
      addPlaceholder="new step…"
    />
  </div>
);
