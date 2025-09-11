import React, { useState, useRef, useEffect } from "react";
import "./SearchableDropdown.scss";

interface SearchableDropdownProps {
  options: (string | { id: string; name?: string; fullName?: string })[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  disabled?: boolean;
  showAllOption?: boolean;
  allOptionText?: string;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  options,
  value,
  onChange,
  placeholder,
  className = "",
  disabled = false,
  showAllOption = true,
  allOptionText = "All",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Create options with "All" option
  const allOptions = showAllOption ? [{ id: "all", name: allOptionText, fullName: allOptionText }] : [];
  const allOptionsWithData = [...allOptions, ...options];

  // Filter options based on search term
  const filteredOptions = allOptionsWithData.filter((option) => {
    if (!searchTerm) return true;

    const displayName = typeof option === "string" ? option : option.name || option.fullName || "";
    return displayName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Get display name for an option
  const getDisplayName = (option: string | { id: string; name?: string; fullName?: string }) => {
    return typeof option === "string" ? option : option.name || option.fullName || "Unknown";
  };

  // Get value for an option
  const getValue = (option: string | { id: string; name?: string; fullName?: string }) => {
    return typeof option === "string" ? option : option.id || getDisplayName(option);
  };

  // Find the selected option
  const selectedOption = allOptionsWithData.find((option) => getValue(option) === value);
  const selectedDisplayName = selectedOption ? getDisplayName(selectedOption) : "";

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setHighlightedIndex(-1);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  // Handle trigger click
  const handleTriggerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    if (newIsOpen) {
      // Focus the input when opening
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  // Handle input focus - only open if not already open
  const handleInputFocus = () => {
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  // Handle option selection
  const handleOptionSelect = (option: string | { id: string; name?: string; fullName?: string }) => {
    const optionValue = getValue(option);
    onChange(optionValue);
    setSearchTerm("");
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleOptionSelect(filteredOptions[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm("");
        setHighlightedIndex(-1);
        break;
    }
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
        setHighlightedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => {
        document.removeEventListener("click", handleClickOutside);
      };
    }
  }, [isOpen]);

  // Reset highlighted index when filtered options change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filteredOptions.length]);

  return (
    <div className={`searchable-dropdown`} ref={dropdownRef}>
      <div
        className={`dropdown-trigger ${isOpen ? "open" : ""} ${disabled ? "disabled" : ""}`}
        onClick={handleTriggerClick}
      >
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : selectedDisplayName}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          disabled={disabled}
          className="dropdown-input"
        />
        <span className="dropdown-arrow">▼</span>
      </div>

      {isOpen && (
        <div className="dropdown-menu">
          {filteredOptions.length === 0 ? (
            <div className="dropdown-item no-results">No options found</div>
          ) : (
            filteredOptions.map((option, index) => {
              const displayName = getDisplayName(option);
              const optionValue = getValue(option);
              const isSelected = optionValue === value;
              const isHighlighted = index === highlightedIndex;

              return (
                <div
                  key={`option-${index}-${optionValue}`}
                  className={`dropdown-item ${isSelected ? "selected" : ""} ${isHighlighted ? "highlighted" : ""}`}
                  onClick={() => handleOptionSelect(option)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  {displayName}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableDropdown;
