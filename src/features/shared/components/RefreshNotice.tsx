import React from "react";
// The components' own files, not the src/ui barrel: the barrel pulls in react-router-dom, which Jest can't resolve.
import { Button } from "../../../ui/Button";
import { Icon } from "../../../ui/Icon";
import "./RefreshNotice.scss";

interface RefreshNoticeProps {
  /** What failed, e.g. "Failed to load courts. Please try again." */
  message: string;
  onRetry: () => void;
  className?: string;
}

/**
 * A refresh that failed while the list is still on screen: the list stays (it may be out of date), with this note and
 * Try again above it. A first load that fails is a full-page error instead.
 */
export function RefreshNotice({ message, onRetry, className }: RefreshNoticeProps): React.JSX.Element {
  return (
    <div className={["refresh-notice", className].filter(Boolean).join(" ")} role="alert">
      <Icon name="alert" size={16} className="refresh-notice__icon" />
      <span className="refresh-notice__text">{message}</span>
      <Button variant="tint" size="sm" icon="refresh" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export default RefreshNotice;
