import React, { useRef } from "react";

export interface SegmentOption {
  value: string;
  label: string;
  count?: number;
}

/**
 * Tablist behaviour shared by Segmented and UnderlineTabs: one tab in the tab order (the selected one), arrow keys,
 * Home and End move the selection and the focus.
 */
export function useTabList(options: SegmentOption[], value: string, onChange: (v: string) => void) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1;
    const moves: Record<string, number> = {
      ArrowRight: selectedIndex === last ? 0 : selectedIndex + 1,
      ArrowLeft: selectedIndex === 0 ? last : selectedIndex - 1,
      Home: 0,
      End: last,
    };
    const next = moves[event.key];
    if (next === undefined || options.length === 0) return;
    event.preventDefault();
    onChange(options[next].value);
    tabs.current[next]?.focus();
  };

  const tabProps = (index: number) => {
    const selected = options[index].value === value;
    return {
      ref: (element: HTMLButtonElement | null) => {
        tabs.current[index] = element;
      },
      type: "button" as const,
      role: "tab",
      "aria-selected": selected,
      tabIndex: index === selectedIndex ? 0 : -1,
      onClick: () => onChange(options[index].value),
      onKeyDown,
    };
  };

  return { tabProps };
}
