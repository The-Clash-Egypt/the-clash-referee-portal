import { QueryClient, useQuery } from "@tanstack/react-query";
import { getRefereeTeamOptions } from "../api/refereeTeams";
import { RefereeTeamOption } from "../types/match";

/** Query-key root for the options, so a page can refresh them after assigning or unassigning. */
export const REFEREE_TEAM_OPTIONS_KEY = "refereeTeamOptions";

/** Teams that can referee the given matches. Fetched afresh each time a drawer opens. */
export const useRefereeTeamOptions = (matchIds: string[], enabled: boolean) =>
  useQuery<RefereeTeamOption[]>({
    queryKey: [REFEREE_TEAM_OPTIONS_KEY, matchIds],
    queryFn: () => getRefereeTeamOptions(matchIds),
    enabled: enabled && matchIds.length > 0,
    // Assignments change under the drawer (another admin, a card's unassign), so never trust a cached list.
    staleTime: 0,
    retry: 1,
  });

/**
 * After an assignment change, drop every cached options list, so no drawer can show a stale one: an open
 * drawer reloads (with its loading state), and a closed one (its query is disabled, so a plain invalidate
 * would not refetch it) starts from "Loading teams..." when it reopens.
 */
export const forgetRefereeTeamOptions = (client: QueryClient) =>
  client.resetQueries({ queryKey: [REFEREE_TEAM_OPTIONS_KEY] });
