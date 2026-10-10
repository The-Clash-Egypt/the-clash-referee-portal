import React from "react";
import { Icon } from "./Icon";
import "./AppBar.scss";

interface AppBarProps {
  /** Small label above the title, e.g. "Beach volleyball · Day 2". */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** Shows the back button. */
  onBack?: () => void;
  backLabel?: string;
  /** The right end of the title row: the wordmark, a status tag, a link. */
  right?: React.ReactNode;
  /** brand = solid blue; spark = orange (select mode). */
  tone?: "brand" | "spark";
  /** Rendered under the title row: search, filters, the wide-screen tab nav. */
  children?: React.ReactNode;
}

/** The solid bar on top of the tournament screens (mockup `.appbar`; select mode `.selbar`). */
export function AppBar({
  eyebrow,
  title,
  onBack,
  backLabel = "Back",
  right,
  tone = "brand",
  children,
}: AppBarProps): React.JSX.Element {
  return (
    <header className={`ui-appbar ui-appbar--${tone}`}>
      <div className="ui-appbar__inner">
        <div className="ui-appbar__top">
          {onBack ? (
            <button type="button" className="ui-appbar__back" aria-label={backLabel} onClick={onBack}>
              <Icon name="back" size={17} />
            </button>
          ) : null}
          <div className="ui-appbar__titles">
            {eyebrow ? <p className="ui-appbar__eyebrow">{eyebrow}</p> : null}
            <h1 className="ui-appbar__title">{title}</h1>
          </div>
          {right ? <div className="ui-appbar__right">{right}</div> : null}
        </div>
        {children ? <div className="ui-appbar__below">{children}</div> : null}
      </div>
    </header>
  );
}

export default AppBar;
