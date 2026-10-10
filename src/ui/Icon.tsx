import React from "react";
import "./Icon.scss";

export type IconName =
  | "back" | "chevron-right" | "chevron-down" | "search" | "filter" | "close" | "plus" | "minus" | "check"
  | "person" | "team" | "share" | "qr" | "edit" | "whatsapp" | "lock" | "unlock" | "calendar" | "clock"
  | "matches" | "courts" | "mexicano" | "more" | "rotate" | "upright" | "swap" | "keyboard" | "print"
  | "list" | "logout" | "switch" | "trash" | "eye" | "eye-off" | "link" | "refresh" | "copy" | "alert" | "download";

// Line icons on a 24 x 24 grid, drawn like the approved mockups: a currentColor stroke, no fill, square ends.
const PATHS: Record<IconName, React.ReactNode> = {
  back: <path d="M15 5l-7 7 7 7" />,
  "chevron-right": <path d="M9 5l7 7-7 7" />,
  "chevron-down": <path d="M6 9l6 6 6-6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </>
  ),
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 20c.8-3.6 3.3-5.5 6.5-5.5s5.7 1.9 6.5 5.5M15.5 5.1a3.5 3.5 0 0 1 0 6.8M17.5 14.8c2.2.6 3.6 2.4 4 5.2" />
    </>
  ),
  share: <path d="M4 12v7h16v-7M12 3v12M7 8l5-5 5 5" />,
  qr: (
    <>
      <rect x="4" y="4" width="6" height="6" />
      <rect x="14" y="4" width="6" height="6" />
      <rect x="4" y="14" width="6" height="6" />
      <path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2" />
    </>
  ),
  edit: <path d="M4 20h4l10-10-4-4L4 16v4zM13 7l4 4" />,
  whatsapp: <path d="M4 20l1.5-4A8 8 0 1 1 9 19.5L4 20z" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  unlock: (
    <>
      <rect x="5" y="11" width="14" height="10" />
      <path d="M8 11V7a4 4 0 0 1 8 0" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  matches: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <path d="M3 10h18M9 4v16" />
    </>
  ),
  courts: (
    <>
      <rect x="4" y="3" width="16" height="18" />
      <path d="M4 12h16M12 3v18" />
    </>
  ),
  mexicano: <path d="M4 18l5-6 4 3 7-9" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </>
  ),
  rotate: (
    <>
      <rect x="2.5" y="11" width="14" height="9" rx="1.5" />
      <path d="M12.5 3.5a7.5 7.5 0 0 1 8 6.5M20.5 10l-2.7-1M20.5 10l1-2.6" />
    </>
  ),
  upright: <rect x="7" y="3" width="10" height="18" rx="1.5" />,
  swap: <path d="M4 7h16M20 7l-3-3M20 7l-3 3M20 17H4M4 17l3-3M4 17l3 3" />,
  keyboard: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="1.5" />
      <path d="M6 10h1.5M10 10h1.5M14 10h1.5M17.5 10H19M7.5 14h9" />
    </>
  ),
  print: (
    <>
      <path d="M7 9V3h10v6" />
      <rect x="3" y="9" width="18" height="8" />
      <path d="M7 14h10v7H7z" />
    </>
  ),
  list: <path d="M4 6h16M4 12h16M4 18h10" />,
  logout: <path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" />,
  switch: <path d="M4 7h13M14 4l3 3-3 3M20 17H7M10 14l-3 3 3 3" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  "eye-off": (
    <>
      <path d="M4 4l16 16" />
      <path d="M10.6 6.1c.5-.1.9-.1 1.4-.1 6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.7M6.6 7.6A16.6 16.6 0 0 0 2.5 12S6 18.5 12 18.5c1.6 0 3.1-.4 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  link: (
    <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" />
  ),
  refresh: (
    <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 3.5V8h4.5M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20.5V16h-4.5" />
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" />
      <path d="M16 8V4H4v12h4" />
    </>
  ),
  alert: <path d="M12 3.5L2.5 20h19L12 3.5zM12 10v4.5M12 16.5v2" />,
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
};

interface IconProps {
  name: IconName;
  /** Width and height in px (default 18). */
  size?: number;
  className?: string;
  /** Accessible name. Without one the icon is decoration and hidden from assistive tech. */
  title?: string;
}

/** A brand line icon. It paints in the CSS `color` of where it sits (stroke = currentColor). */
export function Icon({ name, size = 18, className, title }: IconProps): React.JSX.Element {
  const classes = ["ui-icon", className].filter(Boolean).join(" ");
  return (
    <svg
      className={classes}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      focusable="false"
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  );
}

export default Icon;
