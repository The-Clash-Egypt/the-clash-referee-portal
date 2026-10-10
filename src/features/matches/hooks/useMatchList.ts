import { useCallback, useMemo } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getRefereeMatches } from "../api/matches";
import { FilterOptions, Match, MatchFilters } from "../types/match";
import { doneRequestPages, TAB_STATUS } from "../utils/timeline";
import { normalizeFilterOptions } from "../utils/filterOptions";
import { MatchFilterState } from "./useMatchFilters";

/** Matches per "Load more". */
export const PAGE_SIZE = 30;

type CountsFilters = Omit<MatchFilterState, "tab">;

// The server ignores the search for its counts and filter options, so the counts call leaves it out: typing doesn't
// refetch them.
const countsKeyFilters = ({ search: _search, ...rest }: CountsFilters) => rest;

export const matchListKeys = {
  all: ["referee-matches"] as const,
  list: (tid: string, f: MatchFilterState): unknown[] => [...matchListKeys.all, "list", tid, f],
  counts: (tid: string, f: CountsFilters): unknown[] => [...matchListKeys.all, "counts", tid, countsKeyFilters(f)],
};

/** The API's filters for the matches screen's state ("all" = no filter). */
const toApiFilters = (tournamentId: string, f: Omit<MatchFilterState, "tab">): MatchFilters => ({
  search: f.search || undefined,
  tournament: tournamentId,
  category: f.category !== "all" ? f.category : undefined,
  format: f.format !== "all" ? f.format : undefined,
  round: f.round !== "all" ? f.round : undefined,
  venues: f.venues.length > 0 ? f.venues : undefined,
  team: f.team !== "all" ? f.team : undefined,
  referee: f.referee !== "all" ? f.referee : undefined,
  date: f.date !== "all" ? f.date : undefined,
});

/** A page param: the page number, and whether it is the first page of the list (Done may correct it). */
interface PageParam {
  page: number;
  first: boolean;
}

interface ListPage {
  page: number;
  totalPages: number;
  items: Match[];
}

export interface MatchCounts {
  live: number;
  next: number;
  done: number;
}

/**
 * The matches screen's data. Two backend quirks are handled here (no backend change):
 * - The server counts the tabs after applying the status filter, so a tab's own call reports 0 for the others. The
 *   counts (and the filter options) come from a second call with the same filters, status "all" and one item per page;
 *   switching tabs reuses it.
 * - The server lists oldest first, so Done asks for its pages from the last one back and shows each page reversed:
 *   newest first. The last page comes from the completed count; when the search leaves fewer pages (the counts ignore
 *   the search), the first answer's own page count corrects it.
 * Matches without a start time are in no status; Up next ends with them (they come first in a status "all" list).
 */
export function useMatchList(
  tournamentId: string,
  filters: MatchFilterState,
  options: { enabled?: boolean } = {}
): {
  matches: Match[];
  counts: MatchCounts;
  filterOptions: FilterOptions;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  hasMore: boolean;
  loadMore: () => void;
  isFetchingMore: boolean;
  /** The counts call has answered for the current filters (defaults can be worked out). */
  countsReady: boolean;
} {
  const { enabled = true } = options;
  const { tab, ...rest } = filters;

  const countsQuery = useQuery({
    queryKey: matchListKeys.counts(tournamentId, rest),
    queryFn: async () =>
      (
        await getRefereeMatches({
          ...toApiFilters(tournamentId, { ...rest, search: "" }),
          status: "all",
          pageSize: 1,
          pageNumber: 1,
        })
      ).data.data,
    enabled: !!tournamentId,
    placeholderData: keepPreviousData,
    staleTime: 0,
  });

  const countsData = countsQuery.data;
  const countsReady = countsQuery.isSuccess && !countsQuery.isPlaceholderData;
  const unscheduled = countsData
    ? Math.max(
        0,
        (countsData.matches?.pagination?.total ?? 0) -
          (countsData.inProgressCount || 0) -
          (countsData.incomingCount || 0) -
          (countsData.completedCount || 0)
      )
    : 0;
  const counts: MatchCounts = useMemo(
    () => ({
      live: countsData?.inProgressCount || 0,
      next: (countsData?.incomingCount || 0) + unscheduled,
      done: countsData?.completedCount || 0,
    }),
    [countsData, unscheduled]
  );
  const filterOptions = useMemo(() => normalizeFilterOptions(countsData?.filters), [countsData]);

  const descending = tab === "done";
  const doneTotal = countsData?.completedCount || 0;
  const nothingDone = descending && countsReady && doneTotal === 0;
  const listEnabled = enabled && !!tournamentId && (!descending || (countsReady && !nothingDone));

  const listQuery = useInfiniteQuery({
    queryKey: matchListKeys.list(tournamentId, filters),
    enabled: listEnabled,
    staleTime: 0,
    initialPageParam: { page: descending ? doneRequestPages(doneTotal, PAGE_SIZE)[0] ?? 1 : 1, first: true } as PageParam,
    queryFn: async ({ pageParam }): Promise<ListPage> => {
      const request = async (page: number) =>
        (
          await getRefereeMatches({
            ...toApiFilters(tournamentId, rest),
            status: TAB_STATUS[tab],
            pageSize: PAGE_SIZE,
            pageNumber: page,
          })
        ).data.data.matches;

      let page = pageParam.page;
      let result = await request(page);
      if (descending && pageParam.first) {
        const lastPage = result?.pagination?.totalPages || 0;
        if (lastPage > 0 && lastPage !== page) {
          page = lastPage;
          result = await request(page);
        }
      }
      const items = result?.items ?? [];
      return {
        page,
        totalPages: result?.pagination?.totalPages || 0,
        items: descending ? items.slice().reverse() : items,
      };
    },
    getNextPageParam: (last: ListPage): PageParam | undefined => {
      if (descending) return last.page > 1 ? { page: last.page - 1, first: false } : undefined;
      return last.page < last.totalPages ? { page: last.page + 1, first: false } : undefined;
    },
  });

  const listMatches = useMemo(() => {
    const seen = new Set<string>();
    const all: Match[] = [];
    // A match can move between pages while they load (it started, got rescheduled): show it once.
    listQuery.data?.pages.forEach((p) =>
      p.items.forEach((match) => {
        if (seen.has(match.id)) return;
        seen.add(match.id);
        all.push(match);
      })
    );
    return all;
  }, [listQuery.data]);

  const listComplete = listQuery.isSuccess && !listQuery.hasNextPage;
  const unscheduledQuery = useQuery({
    queryKey: [...matchListKeys.all, "unscheduled", tournamentId, rest],
    enabled: tab === "next" && listEnabled && unscheduled > 0 && listComplete,
    staleTime: 0,
    queryFn: async () => {
      const result = (
        await getRefereeMatches({
          ...toApiFilters(tournamentId, rest),
          status: "all",
          pageSize: PAGE_SIZE,
          pageNumber: 1,
        })
      ).data.data.matches;
      return (result?.items ?? []).filter((match) => !match.startTime && !match.isCompleted);
    },
  });

  const matches = useMemo(() => {
    if (tab !== "next" || !unscheduledQuery.data?.length) return listMatches;
    const ids = new Set(listMatches.map((match) => match.id));
    return listMatches.concat(unscheduledQuery.data.filter((match) => !ids.has(match.id)));
  }, [tab, listMatches, unscheduledQuery.data]);

  const { refetch: refetchCounts } = countsQuery;
  const { refetch: refetchList, fetchNextPage } = listQuery;
  const refetch = useCallback(() => {
    void refetchCounts();
    void refetchList();
  }, [refetchCounts, refetchList]);
  const loadMore = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  return {
    matches,
    counts,
    filterOptions,
    isLoading: !nothingDone && (listEnabled ? listQuery.isPending : !(descending && countsQuery.isError)),
    // No counts at all (first load, or Done which pages by them) is an error too: there is nothing to show.
    isError: listQuery.isError || (countsQuery.isError && (!countsData || descending)),
    refetch,
    hasMore: !!listQuery.hasNextPage,
    loadMore,
    isFetchingMore: listQuery.isFetchingNextPage,
    countsReady,
  };
}

export default useMatchList;
