import React, { createContext, useContext, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

/** Where a tab can put its own controls in the tournament frame (each null until the layout has mounted it). */
export interface TournamentSlots {
  /** Under the app bar's title row (the matches search and Filters button). */
  below: HTMLElement | null;
  /** In place of the whole app bar, while a tab takes the frame over (select mode's orange bar). */
  bar: HTMLElement | null;
  /** In place of the bottom tab bar, while a tab takes the frame over (select mode's bulk bar). */
  bottom: HTMLElement | null;
  /** Hides the app bar and the tabs while true. */
  setTakeover: (on: boolean) => void;
}

const AppBarSlotContext = createContext<TournamentSlots | null>(null);

/** Set by TournamentLayout around its tabs. */
export const AppBarSlotProvider = AppBarSlotContext.Provider;

/**
 * Puts a tab's own controls into the blue app bar, under the title (mockup `.appbar .search`: the matches search and
 * Filters button). Rendered through a portal, so the controls stay in the tab's React tree. Outside a tournament
 * layout it renders nothing.
 */
export function AppBarSlot({ children }: { children: React.ReactNode }): React.ReactPortal | null {
  const slots = useContext(AppBarSlotContext);
  return slots?.below ? createPortal(children, slots.below) : null;
}

/**
 * While mounted, `bar` replaces the tournament app bar and `bottom` the tab bar (both the phone's bottom bar and the
 * wide-screen nav, which lives in the app bar): select mode's orange bar and its bulk actions (mockup
 * match-flow-v2.html phone 5). Unmounting gives the frame back.
 */
export function AppBarTakeover({ bar, bottom }: { bar: React.ReactNode; bottom?: React.ReactNode }): React.JSX.Element | null {
  const slots = useContext(AppBarSlotContext);
  const setTakeover = slots?.setTakeover;

  // Before paint, so the app bar and the takeover bar never show together.
  useLayoutEffect(() => {
    if (!setTakeover) return undefined;
    setTakeover(true);
    return () => setTakeover(false);
  }, [setTakeover]);

  if (!slots) return null;
  return (
    <>
      {slots.bar ? createPortal(bar, slots.bar) : null}
      {bottom && slots.bottom ? createPortal(bottom, slots.bottom) : null}
    </>
  );
}

export default AppBarSlot;
