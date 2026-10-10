import React from "react";
import { NavLink } from "react-router-dom";
import { Icon, IconName } from "./Icon";
import "./TabBar.scss";

export interface TabItem {
  to: string;
  label: string;
  icon: IconName;
  /** Only active on an exact match (NavLink `end`). */
  end?: boolean;
}

interface TabBarProps {
  items: TabItem[];
  /** bottom = the fixed phone bar (hidden from 900px); top = the inline nav for the app bar (hidden below 900px). */
  placement: "bottom" | "top";
}

/**
 * The tournament sections (Matches · Courts · Mexicano · More), as NavLinks: the active one gets aria-current="page".
 * The bottom bar is fixed, so the page leaves `var(--tabbar-h)` plus the safe area free under its content.
 */
export function TabBar({ items, placement }: TabBarProps): React.JSX.Element {
  return (
    <nav className={`ui-tabbar ui-tabbar--${placement}`} aria-label="Sections">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `ui-tabbar__item${isActive ? " ui-tabbar__item--on" : ""}`}
        >
          <Icon name={item.icon} size={placement === "bottom" ? 21 : 16} />
          <span className="ui-tabbar__label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default TabBar;
