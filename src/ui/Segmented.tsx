import React from "react";
import { SegmentOption, useTabList } from "./tabList";
import "./Segmented.scss";

export type { SegmentOption } from "./tabList";

interface SegmentedProps {
  options: SegmentOption[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}

/** Equal slanted segments with counts, the active one orange (mockup `.seg`: Live · Up next · Done). */
export function Segmented({ options, value, onChange, ariaLabel }: SegmentedProps): React.JSX.Element {
  const { tabProps } = useTabList(options, value, onChange);
  return (
    <div className="ui-seg" role="tablist" aria-label={ariaLabel}>
      {options.map((option, index) => (
        <button
          key={option.value}
          {...tabProps(index)}
          className={`ui-seg__tab${option.value === value ? " ui-seg__tab--on" : ""}`}
        >
          {option.label}
          {option.count !== undefined ? (
            <>
              {" "}
              <b className="ui-seg__count">{option.count}</b>
            </>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export default Segmented;
