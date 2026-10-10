import React from "react";
import "./Checkbox.scss";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** Keep the label for screen readers only (e.g. a row's checkbox in select mode). */
  hideLabel?: boolean;
}

/** A square brand checkbox, orange when ticked (mockup `.check`). A real checkbox underneath. */
export function Checkbox({ checked, onChange, label, hideLabel = false }: CheckboxProps): React.JSX.Element {
  return (
    <label className={`ui-check${hideLabel ? " ui-check--bare" : ""}`}>
      <input
        className="ui-check__input"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="ui-check__box" aria-hidden="true" />
      <span className={hideLabel ? "ui-visually-hidden" : "ui-check__label"}>{label}</span>
    </label>
  );
}

export default Checkbox;
