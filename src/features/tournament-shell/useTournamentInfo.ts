import { useSearchParams } from "react-router-dom";
import { useTournaments } from "../tournaments/hooks";

export interface TournamentInfo {
  id: string;
  name: string;
  sport?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * What the tournament screens show about their tournament: from the (cached) tournaments list, else the `name` query
 * param the links carry, else "Tournament".
 */
export function useTournamentInfo(id: string): TournamentInfo {
  const { data: tournaments } = useTournaments();
  const [searchParams] = useSearchParams();
  const tournament = tournaments?.find((t) => t.id === id);

  return {
    id,
    name: tournament?.name || searchParams.get("name") || "Tournament",
    // Some API responses use `type` instead of `sport`.
    sport: tournament?.sport || tournament?.type || undefined,
    startDate: tournament?.startDate,
    endDate: tournament?.endDate,
  };
}

export default useTournamentInfo;
