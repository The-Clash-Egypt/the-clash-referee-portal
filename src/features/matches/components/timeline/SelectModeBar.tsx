import React from "react";
import { AppBar } from "../../../../ui/AppBar";
import "./SelectModeBar.scss";

interface SelectModeBarProps {
  /** How many matches are selected. */
  count: number;
  /** How many matches are on screen: "Select all M" takes them all. */
  total: number;
  onExit: () => void;
  onSelectAll: () => void;
  onClear: () => void;
}

/**
 * Select mode's app bar (mockup match-flow-v2.html phone 5, `.selbar`): the bar turns orange, with ✕ to leave select
 * mode, "N selected" and "Select all M" (or, once all are selected, the old "Clear selection").
 */
const SelectModeBar: React.FC<SelectModeBarProps> = ({ count, total, onExit, onSelectAll, onClear }) => {
  const allSelected = total > 0 && count >= total;
  return (
    <AppBar
      tone="spark"
      title={`${count} selected`}
      onBack={onExit}
      backLabel="Exit select mode"
      backIcon="close"
      right={
        total > 0 ? (
          <button type="button" className="select-bar__all" onClick={allSelected ? onClear : onSelectAll}>
            {allSelected ? "Clear selection" : `Select all ${total}`}
          </button>
        ) : null
      }
    />
  );
};

export default SelectModeBar;
