import React from "react";
import "./Tag.scss";

export type TagTone = "live" | "grey" | "warn" | "ok" | "orange" | "blue" | "yellow" | "glass";

interface TagProps {
  /** live = red with a dot · grey · warn = orange tint · ok = green tint · orange · blue · yellow (beach volleyball)
   *  · glass = white on a solid bar */
  tone?: TagTone;
  children: React.ReactNode;
  className?: string;
}

/** A small slanted label (mockup `.tag`). */
export function Tag({ tone = "grey", children, className }: TagProps): React.JSX.Element {
  return <span className={["ui-tag", `ui-tag--${tone}`, className].filter(Boolean).join(" ")}>{children}</span>;
}

export default Tag;
