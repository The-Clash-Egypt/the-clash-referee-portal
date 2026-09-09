import React, { useEffect, useRef, useState } from "react";
import "./MultiSelectDropdown.scss";

interface MultiSelectDropdownProps {
  options: string[];
  /** Selected values. Empty means "all", which is how the filter reads when untouched. */
  value: string[];
  onChange: (value: string[]) => void;
  /** Shown when nothing is selected, e.g. "All Venues". */
  allLabel: string;
  /** Plural noun for the summary, e.g. "venues". */
  itemNoun: string;
  className?: string;
  disabled?: boolean;
}

const sameSelection = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((item) => b.includes(item));

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  options,
  value,
  onChange,
  allLabel,
  itemNoun,
  className = "",
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  /**
   * While the menu is open the selection is local. The parent is told once, when
   * the menu closes, so ticking four venues costs one data load rather than four.
   */
  const [draft, setDraft] = useState<string[]>(value);
  const containerRef = useRef<HTMLDivElement>(null);

  // Refs so the document-level listeners below can commit the latest selection
  // without being torn down and re-registered on every render.
  const draftRef = useRef<string[]>(value);
  const valueRef = useRef<string[]>(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;

  const updateDraft = (next: string[]) => {
    draftRef.current = next;
    setDraft(next);
  };

  const openMenu = () => {
    updateDraft(valueRef.current);
    setIsOpen(true);
  };

  const closeMenu = () => {
    setIsOpen(false);
    setSearchTerm("");
    if (!sameSelection(draftRef.current, valueRef.current)) {
      onChangeRef.current(draftRef.current);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const commitAndClose = () => {
      setIsOpen(false);
      setSearchTerm("");
      if (!sameSelection(draftRef.current, valueRef.current)) {
        onChangeRef.current(draftRef.current);
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        commitAndClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") commitAndClose();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const toggle = (option: string) => {
    updateDraft(
      draftRef.current.includes(option)
        ? draftRef.current.filter((item) => item !== option)
        : [...draftRef.current, option]
    );
  };

  // The trigger reflects what has been ticked, not what has been applied, so the
  // menu still feels responsive while the fetch is deferred.
  const selection = isOpen ? draft : value;

  const filteredOptions = searchTerm
    ? options.filter((option) => option.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  const summary = () => {
    if (selection.length === 0) return allLabel;
    if (selection.length === 1) return selection[0];
    return `${selection.length} ${itemNoun}`;
  };

  return (
    <div className={`multi-select-dropdown ${className}`} ref={containerRef}>
      <button
        type="button"
        className={`multi-select-trigger ${isOpen ? "open" : ""} ${selection.length > 0 ? "active" : ""}`}
        onClick={() => {
          if (disabled) return;
          if (isOpen) closeMenu();
          else openMenu();
        }}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="multi-select-summary">{summary()}</span>
        <span className="multi-select-arrow" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6,9 12,15 18,9" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="multi-select-menu" role="listbox" aria-multiselectable="true">
          {options.length > 8 && (
            <input
              type="text"
              className="multi-select-search"
              placeholder="Search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              autoFocus
            />
          )}

          <div className="multi-select-options">
            {filteredOptions.length === 0 ? (
              <div className="multi-select-empty">No matches</div>
            ) : (
              filteredOptions.map((option) => {
                const checked = draft.includes(option);
                return (
                  <label
                    key={option}
                    className={`multi-select-option ${checked ? "checked" : ""}`}
                    role="option"
                    aria-selected={checked}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggle(option)} />
                    <span>{option}</span>
                  </label>
                );
              })
            )}
          </div>

          <div className="multi-select-footer">
            {draft.length > 0 && (
              <button type="button" className="multi-select-clear" onClick={() => updateDraft([])}>
                Clear
              </button>
            )}
            <button type="button" className="multi-select-done" onClick={closeMenu}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelectDropdown;
