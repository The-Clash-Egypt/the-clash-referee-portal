import React from "react";
import "./Spinner.scss";

interface SpinnerProps {
  /** Shown under the spinner and read out. Without one, "Loading" is read out only. */
  label?: string;
  /** Diameter in px (default 28). */
  size?: number;
}

/** The brand loading spinner: an orange ring on its tint. */
export function Spinner({ label, size = 28 }: SpinnerProps): React.JSX.Element {
  return (
    <div className="ui-spinner" role="status">
      <span className="ui-spinner__ring" style={{ width: size, height: size }} aria-hidden="true" />
      <span className={label ? "ui-spinner__label" : "ui-visually-hidden"}>{label || "Loading"}</span>
    </div>
  );
}

interface SkeletonRowsProps {
  /** Number of placeholder rows (default 4). */
  rows?: number;
}

/** Placeholder rows shaped like the match timeline rows, while a list loads. */
export function SkeletonRows({ rows = 4 }: SkeletonRowsProps): React.JSX.Element {
  return (
    <div className="ui-skel" role="status">
      <span className="ui-visually-hidden">Loading</span>
      {Array.from({ length: rows }, (_, i) => (
        <div className="ui-skel__row" key={i} aria-hidden="true">
          <div className="ui-skel__side">
            <span className="ui-skel__bar ui-skel__bar--court" />
            <span className="ui-skel__bar ui-skel__bar--time" />
          </div>
          <div className="ui-skel__main">
            <span className="ui-skel__bar ui-skel__bar--team" />
            <span className="ui-skel__bar ui-skel__bar--team ui-skel__bar--short" />
            <span className="ui-skel__bar ui-skel__bar--tag" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default Spinner;
