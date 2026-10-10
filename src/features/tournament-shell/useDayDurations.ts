import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import { RootState } from "../../store";
import { hasFullAccess } from "../auth/permissions";
import { getRefereeMatches } from "../matches/api/matches";
import { matchListKeys } from "../matches/hooks/useMatchList";
import { FilterOptions } from "../matches/types/match";
import { normalizeFilterOptions } from "../matches/utils/filterOptions";
import { formatDayLabel, formatTime } from "../matches/utils/timeline";
import { getTournamentDayDuration, getTournamentDayTimeRange, groupMatchesByDay } from "../../utils/durationUtils";

/** One tournament day on the More tab: "Sun 11 Oct", "09:00 – 19:10", "10h 10m". */
export interface DayDurationRow {
  /** The day as the duration util groups it (Date.toDateString()). */
  key: string;
  day: string;
  /** The day's first start to its last end (local time). */
  range: string;
  duration: string;
}

/** Under the matches keys, so a saved score or an edit (which refresh those) marks the durations stale too. */
export const dayDurationsKey = (tournamentId: string): unknown[] => [...matchListKeys.all, "day-durations", tournamentId];

/**
 * The day durations of a tournament (More tab, full access only): every match of the tournament in one call, then
 * the existing duration utils day by day — from the first match started to the last one ended. Days with nothing
 * finished have no duration and no row (as before). For anyone without full access nothing is fetched.
 */
export function useDayDurations(tournamentId: string): {
  rows: DayDurationRow[];
  /** Full access and a tournament: the call runs. */
  enabled: boolean;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  /** The same call's filter options: the whole tournament's teams and referees, to name the print filters. */
  filterOptions: FilterOptions;
} {
  const user = useSelector((state: RootState) => state.user.user);
  const enabled = hasFullAccess(user) && !!tournamentId;

  const query = useQuery({
    queryKey: dayDurationsKey(tournamentId),
    queryFn: async () => (await getRefereeMatches({ tournament: tournamentId, status: "all", pageSize: 1000 })).data.data,
    enabled,
    // Scores keep coming in from the courts: show what's cached, and refresh it whenever More opens.
    staleTime: 0,
  });

  const data = enabled ? query.data : undefined;

  const rows = useMemo(() => {
    const byDay = groupMatchesByDay(data?.matches?.items ?? []);
    return Object.entries(byDay)
      .map(([key, dayMatches]) => {
        const duration = getTournamentDayDuration(dayMatches);
        const range = getTournamentDayTimeRange(dayMatches);
        if (!duration || !range) return null;
        const start = range.start.toISOString();
        return {
          key,
          at: range.start.getTime(),
          row: {
            key,
            day: formatDayLabel(start),
            range: `${formatTime(start)} – ${formatTime(range.end.toISOString())}`,
            duration,
          },
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((a, b) => a.at - b.at)
      .map((entry) => entry.row);
  }, [data]);

  const filterOptions = useMemo(() => normalizeFilterOptions(data?.filters), [data]);
  const { refetch } = query;

  return {
    rows,
    enabled,
    isLoading: enabled && query.isLoading,
    isError: enabled && query.isError,
    refetch: () => void refetch(),
    filterOptions,
  };
}

export default useDayDurations;
