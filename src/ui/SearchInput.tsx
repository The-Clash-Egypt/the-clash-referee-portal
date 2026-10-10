import React, { useRef } from "react";
import { Icon } from "./Icon";
import "./SearchInput.scss";

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  /** Defaults to the placeholder. */
  ariaLabel?: string;
  autoFocus?: boolean;
}

/** A white search field with a magnifier and, once it has text, a clear button (mockup `.search .in` / `.sin`). */
export function SearchInput({ value, onChange, placeholder, ariaLabel, autoFocus }: SearchInputProps): React.JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="ui-search">
      <Icon name="search" size={16} className="ui-search__icon" />
      <input
        ref={input}
        className="ui-search__input"
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
      />
      {value ? (
        <button
          type="button"
          className="ui-search__clear"
          aria-label="Clear search"
          onClick={() => {
            onChange("");
            input.current?.focus();
          }}
        >
          <Icon name="close" size={14} />
        </button>
      ) : null}
    </div>
  );
}

export default SearchInput;
