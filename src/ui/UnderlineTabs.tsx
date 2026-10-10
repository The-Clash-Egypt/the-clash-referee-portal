import React from "react";
import { SegmentOption, useTabList } from "./tabList";
import "./UnderlineTabs.scss";

interface UnderlineTabsProps {
  options: SegmentOption[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}

/** A white tab strip with a slanted orange underline on the active tab (mockup `.ctabs`: Round · Players · Leaderboard). */
export function UnderlineTabs({ options, value, onChange, ariaLabel }: UnderlineTabsProps): React.JSX.Element {
  const { tabProps } = useTabList(options, value, onChange);
  return (
    <div className="ui-utabs" role="tablist" aria-label={ariaLabel}>
      {options.map((option, index) => (
        <button
          key={option.value}
          {...tabProps(index)}
          className={`ui-utabs__tab${option.value === value ? " ui-utabs__tab--on" : ""}`}
        >
          {option.label}
          {option.count !== undefined ? (
            <>
              {" "}
              <span className="ui-utabs__count">{option.count}</span>
            </>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export default UnderlineTabs;
