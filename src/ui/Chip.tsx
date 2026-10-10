import React from "react";
import { Icon } from "./Icon";
import "./Chip.scss";

type ChipProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Selected chips are orange (aria-pressed). */
  selected?: boolean;
  /** A count after the label, e.g. "No referee 4". */
  count?: number;
  /** Adds a ✕ button of its own, labelled "Remove <text>". */
  onRemove?: () => void;
};

/** The plain text of a label, for the remove button's name. */
const textOf = (node: React.ReactNode): string => {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return "";
};

/**
 * A slanted toggle chip (mockup `.chip`): grey, orange when selected. Add `ui-chip--card` for a white chip on the grey
 * page. With `onRemove` it gets its own ✕ button (an active filter you can drop).
 */
export function Chip({
  selected = false,
  count,
  onRemove,
  className,
  children,
  type = "button",
  ...rest
}: ChipProps): React.JSX.Element {
  const classes = ["ui-chip", selected ? "ui-chip--on" : "", onRemove ? "ui-chip--removable" : "", className]
    .filter(Boolean)
    .join(" ");
  const content = (
    <>
      {children}
      {count !== undefined ? (
        <>
          {" "}
          <span className="ui-chip__count">{count}</span>
        </>
      ) : null}
    </>
  );

  if (!onRemove) {
    return (
      <button {...rest} type={type} className={classes} aria-pressed={selected}>
        {content}
      </button>
    );
  }

  return (
    <span className={classes}>
      <button {...rest} type={type} className="ui-chip__main" aria-pressed={selected}>
        {content}
      </button>
      <button type="button" className="ui-chip__remove" aria-label={`Remove ${textOf(children)}`} onClick={onRemove}>
        <Icon name="close" size={12} />
      </button>
    </span>
  );
}

export default Chip;
