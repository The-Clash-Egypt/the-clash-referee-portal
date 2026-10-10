import React from "react";
import { Icon, IconName } from "./Icon";
import "./EmptyState.scss";

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  body?: React.ReactNode;
  /** A button or link, e.g. "Clear filters". */
  action?: React.ReactNode;
}

/** A branded empty, error or gate state: white cut-corner card, icon, display title, text and an action. */
export function EmptyState({ icon, title, body, action }: EmptyStateProps): React.JSX.Element {
  return (
    <section className="ui-empty">
      {icon ? (
        <span className="ui-empty__icon" aria-hidden="true">
          <Icon name={icon} size={24} />
        </span>
      ) : null}
      <h2 className="ui-empty__title">{title}</h2>
      {body ? <div className="ui-empty__body">{body}</div> : null}
      {action ? <div className="ui-empty__action">{action}</div> : null}
    </section>
  );
}

export default EmptyState;
