import React from "react";
import { WORDMARK_PATH, WORDMARK_VIEWBOX } from "./wordmark";
import "./BrandLogo.scss";

interface BrandLogoProps {
  className?: string;
  /** Accessible name. Pass "" when text next to the logo already names it. */
  title?: string;
}

/**
 * The Clash wordmark as inline SVG. It paints in the CSS `color` of where it sits (white on the blue bar and on photos).
 * Set its height; the width follows the logo's proportions.
 */
export function BrandLogo({ className, title = "The Clash" }: BrandLogoProps): React.JSX.Element {
  const classes = ["ui-brand-logo", className].filter(Boolean).join(" ");
  return (
    <svg
      className={classes}
      viewBox={WORDMARK_VIEWBOX}
      fill="currentColor"
      focusable="false"
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}
    >
      <path fillRule="evenodd" d={WORDMARK_PATH} />
    </svg>
  );
}

export default BrandLogo;
