import { useCallback, useMemo, useState } from "react";

export interface Selection {
  /** The selected matches that are still in the list. */
  selected: Set<string>;
  /** Select mode is on (rows show checkboxes, the bulk bar replaces the tabs). */
  active: boolean;
  /** Turns select mode on, with `id` selected (a long-pressed row) or nothing (the Select button). */
  start: (id?: string) => void;
  toggle: (id: string) => void;
  selectAll: () => void;
  /** Unselects everything and stays in select mode. */
  clear: () => void;
  /** Unselects some matches (e.g. the ones a bulk sheet has just saved). */
  deselect: (ids: string[]) => void;
  /** Leaves select mode and forgets the selection. */
  exit: () => void;
}

/**
 * Select mode on the matches timeline (mockup match-flow-v2.html phone 5). `ids` are the matches on screen: "select
 * all" takes them, and a match that leaves the list (another tab after a refresh) stops counting as selected.
 */
export function useSelection(ids: string[]): Selection {
  const [active, setActive] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());

  const selected = useMemo(() => new Set(ids.filter((id) => picked.has(id))), [ids, picked]);

  const start = useCallback((id?: string) => {
    setActive(true);
    setPicked((previous) => (id ? new Set(previous).add(id) : previous));
  }, []);

  const toggle = useCallback((id: string) => {
    setPicked((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => setPicked(new Set(ids)), [ids]);

  const clear = useCallback(() => setPicked((previous) => (previous.size === 0 ? previous : new Set())), []);

  const deselect = useCallback((drop: string[]) => {
    setPicked((previous) => {
      const next = new Set(previous);
      drop.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const exit = useCallback(() => {
    setActive(false);
    setPicked((previous) => (previous.size === 0 ? previous : new Set()));
  }, []);

  return { selected, active, start, toggle, selectAll, clear, deselect, exit };
}

export default useSelection;
