import React from "react";
import { Icon, IconName } from "./Icon";
import "./Button.scss";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** primary = orange, tint = orange tint, ghost = quiet grey, danger = red */
  variant?: "primary" | "tint" | "ghost" | "danger";
  /** sm 34px, md 42px, lg 50px (the main action of a screen or sheet) */
  size?: "sm" | "md" | "lg";
  /** Full width */
  block?: boolean;
  /** Busy: disabled, aria-busy and a spinner before the label */
  loading?: boolean;
  icon?: IconName;
};

/** The slanted brand button. `type` defaults to "button"; pass type="submit" in forms. */
export function Button({
  variant = "primary",
  size = "md",
  block = false,
  loading = false,
  icon,
  className,
  disabled,
  type = "button",
  children,
  ...rest
}: ButtonProps): React.JSX.Element {
  const classes = [
    "ui-btn",
    `ui-btn--${variant}`,
    `ui-btn--${size}`,
    block ? "ui-btn--block" : "",
    loading ? "ui-btn--loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      {...rest}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading ? true : undefined}
    >
      {loading ? (
        <span className="ui-btn__spinner" aria-hidden="true" />
      ) : icon ? (
        <Icon name={icon} size={size === "sm" ? 15 : 17} />
      ) : null}
      {children}
    </button>
  );
}

export default Button;
