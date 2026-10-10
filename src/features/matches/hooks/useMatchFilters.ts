import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MatchTab, TAB_STATUS } from "../utils/timeline";

/** Everything the matches screen is filtered by. "all" (or [] for courts, "" for search) = no filter. */
export interface MatchFilterState {
  tab: MatchTab;
  search: string;
  date: string;
  category: string;
  format: string;
  round: string;
  venues: string[];
  team: string;
  referee: string;
}

/** How long typing waits before the search reaches the URL (and the API). */
export const SEARCH_DEBOUNCE_MS = 300;

const TAB_OF_STATUS: Record<string, MatchTab> = { all: "all", "in-progress": "live", upcoming: "next", completed: "done" };

// Single-value filters and their URL params ("all" = param absent). The tab lives in `status` (the API value), the
// day in `date` ("all" is written out so the "today" default doesn't come back), courts repeat `venues`.
const SIMPLE_KEYS = ["category", "format", "round", "team", "referee"] as const;
type SimpleKey = (typeof SIMPLE_KEYS)[number];

const readFilters = (params: URLSearchParams): MatchFilterState => {
  const venues = params.getAll("venues").filter(Boolean);
  // `venue` is kept for older shared links.
  const legacyVenue = params.get("venue");
  if (venues.length === 0 && legacyVenue && legacyVenue !== "all") venues.push(legacyVenue);
  const simple = (key: SimpleKey) => params.get(key) || "all";
  return {
    tab: TAB_OF_STATUS[params.get("status") ?? ""] ?? "live",
    search: params.get("search") ?? "",
    date: params.get("date") || "all",
    category: simple("category"),
    format: simple("format"),
    round: simple("round"),
    venues,
    team: simple("team"),
    referee: simple("referee"),
  };
};

/** Writes one filter into the params (search excepted: it is debounced). */
const writeFilter = <K extends keyof MatchFilterState>(params: URLSearchParams, key: K, value: MatchFilterState[K]) => {
  switch (key) {
    case "tab":
      params.set("status", TAB_STATUS[value as MatchTab]);
      break;
    case "search":
      if (value) params.set("search", value as string);
      else params.delete("search");
      break;
    case "date":
      params.set("date", (value as string) || "all");
      break;
    case "venues":
      params.delete("venues");
      params.delete("venue");
      (value as string[]).forEach((venue) => params.append("venues", venue));
      break;
    default:
      if (value && value !== "all") params.set(key, value as string);
      else params.delete(key);
  }
};

/** How many filter chips are active (each court counts; the tab and the search don't). */
export const countActiveFilters = (f: MatchFilterState): number =>
  (f.date !== "all" ? 1 : 0) + SIMPLE_KEYS.filter((key) => f[key] !== "all").length + f.venues.length;

/**
 * The matches screen's filters, all kept in the URL (so tabs, reloads and shared links keep them). The `name` param
 * the links carry is left alone. Typing in the search box shows at once (`searchInput`) and reaches the URL — and with
 * it `filters.search` and the API — 300 ms after the last keystroke.
 */
export function useMatchFilters(): {
  filters: MatchFilterState;
  /** What the search box shows: ahead of `filters.search` while typing. */
  searchInput: string;
  setFilter: <K extends keyof MatchFilterState>(k: K, v: MatchFilterState[K]) => void;
  clearAll: () => void;
  activeCount: number;
  hasExplicitTab: boolean;
  hasExplicitDate: boolean;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.toString();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filters = useMemo(() => readFilters(searchParams), [query]);
  const hasExplicitTab = TAB_OF_STATUS[searchParams.get("status") ?? ""] !== undefined;
  const hasExplicitDate = searchParams.has("date");

  // Several writes in one tick each build on the last, not on the params this render started with.
  const paramsRef = useRef(searchParams);
  paramsRef.current = searchParams;
  const write = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(paramsRef.current);
      mutate(next);
      // Paging moved to "Load more": old page params mean nothing now.
      next.delete("page");
      next.delete("pageSize");
      paramsRef.current = next;
      setSearchParams(next, { replace: true });
    },
    [setSearchParams]
  );

  const [searchInput, setSearchInput] = useState(filters.search);
  const timer = useRef<number | undefined>(undefined);
  const written = useRef(filters.search);

  // The URL's search changed from outside (back button, Clear all, a link): show it.
  useEffect(() => {
    if (filters.search !== written.current) {
      written.current = filters.search;
      setSearchInput(filters.search);
    }
  }, [filters.search]);

  // A pending search write must not fire after the screen has gone (it would navigate back to it).
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const setFilter = useCallback(
    <K extends keyof MatchFilterState>(key: K, value: MatchFilterState[K]) => {
      if (key === "search") {
        const text = value as string;
        setSearchInput(text);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          written.current = text;
          write((params) => writeFilter(params, "search", text));
        }, SEARCH_DEBOUNCE_MS);
        return;
      }
      write((params) => writeFilter(params, key, value));
    },
    [write]
  );

  const clearAll = useCallback(() => {
    window.clearTimeout(timer.current);
    written.current = "";
    setSearchInput("");
    write((params) => {
      SIMPLE_KEYS.forEach((key) => params.delete(key));
      params.delete("venues");
      params.delete("venue");
      params.delete("search");
      params.set("date", "all");
    });
  }, [write]);

  return {
    filters,
    searchInput,
    setFilter,
    clearAll,
    activeCount: countActiveFilters(filters),
    hasExplicitTab,
    hasExplicitDate,
  };
}

export default useMatchFilters;
