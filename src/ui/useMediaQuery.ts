import { useCallback, useSyncExternalStore } from "react";

const canMatch = () => typeof window !== "undefined" && typeof window.matchMedia === "function";

/**
 * Whether a CSS media query matches now, kept up to date as the window changes, e.g.
 * `useMediaQuery("(max-width: 767px)")` for phones. False where matchMedia is missing (Jest, old browsers).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!canMatch()) return () => undefined;
      const list = window.matchMedia(query);
      // Safari before 14 only has the old addListener API.
      if (typeof list.addEventListener === "function") {
        list.addEventListener("change", onChange);
        return () => list.removeEventListener("change", onChange);
      }
      list.addListener(onChange);
      return () => list.removeListener(onChange);
    },
    [query]
  );
  const getSnapshot = () => (canMatch() ? window.matchMedia(query).matches : false);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export default useMediaQuery;
