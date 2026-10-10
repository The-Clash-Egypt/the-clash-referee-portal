import React from "react";
import "./Checkbox.scss";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** Keep the label for screen readers only (e.g. a row's checkbox in select mode). */
  hideLabel?: boolean;
  disabled?: boolean;
  /** Extra classes on the label, e.g. for a whole row that toggles. */
  className?: string;
  /**
   * Rich content after the box instead of the label text: the whole thing (a row) toggles the box, and `label` alone
   * names it for screen readers.
   */
  children?: React.ReactNode;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}

/** A square brand checkbox, orange when ticked (mockup `.check`). A real checkbox underneath. */
export function Checkbox({
  checked,
  onChange,
  label,
  hideLabel = false,
  disabled = false,
  className,
  children,
  onKeyDown,
}: CheckboxProps): React.JSX.Element {
  const rich = children !== undefined && children !== null;
  const classes = ["ui-check", hideLabel ? "ui-check--bare" : "", disabled ? "ui-check--disabled" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <label className={classes}>
      <input
        className="ui-check__input"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={rich ? label : undefined}
        onChange={(event) => onChange(event.target.checked)}
        onKeyDown={onKeyDown}
      />
      <span className="ui-check__box" aria-hidden="true" />
      {rich ? children : <span className={hideLabel ? "ui-visually-hidden" : "ui-check__label"}>{label}</span>}
    </label>
  );
}

export default Checkbox;
