import { useCallback, useState } from "react";
import { useMediaQuery } from "../../../../ui/useMediaQuery";

/** Where this device remembers the choice: "1" = sideways, "0" = upright. */
export const LANDSCAPE_STORAGE_KEY = "portal.scoreboard.landscape";
const PORTRAIT_QUERY = "(orientation: portrait)";

const readForced = (): boolean => {
  try {
    return window.localStorage.getItem(LANDSCAPE_STORAGE_KEY) === "1";
  } catch {
    return false; // storage blocked (private mode): start upright
  }
};

/**
 * The scoreboard's ⟳ switch for phones whose rotation lock is on. `forced` is remembered per device; the layout is
 * landscape when the viewport is landscape or the switch is on, and `rotate` (the switch on in a portrait viewport) is
 * when the scoreboard turns itself sideways with CSS (`is-rotated`).
 */
export function useForcedLandscape(): { forced: boolean; toggle: () => void; viewportPortrait: boolean; rotate: boolean } {
  const [forced, setForced] = useState(readForced);
  const viewportPortrait = useMediaQuery(PORTRAIT_QUERY);

  const toggle = useCallback(() => {
    const next = !forced;
    setForced(next);
    try {
      window.localStorage.setItem(LANDSCAPE_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Storage blocked: the switch still works for this visit.
    }
  }, [forced]);

  return { forced, toggle, viewportPortrait, rotate: forced && viewportPortrait };
}

export default useForcedLandscape;
