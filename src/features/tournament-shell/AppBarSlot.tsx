import React, { createContext, useContext } from "react";
import { createPortal } from "react-dom";

/** The element under the tournament app bar's title row that a tab can fill (null until the bar has mounted). */
const AppBarSlotContext = createContext<HTMLElement | null>(null);

/** Set by TournamentLayout around its tabs. */
export const AppBarSlotProvider = AppBarSlotContext.Provider;

/**
 * Puts a tab's own controls into the blue app bar, under the title (mockup `.appbar .search`: the matches search and
 * Filters button). Rendered through a portal, so the controls stay in the tab's React tree. Outside a tournament
 * layout it renders nothing.
 */
export function AppBarSlot({ children }: { children: React.ReactNode }): React.ReactPortal | null {
  const target = useContext(AppBarSlotContext);
  return target ? createPortal(children, target) : null;
}

export default AppBarSlot;
