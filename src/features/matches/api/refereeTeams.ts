import api from "../../../api/axios";
import { RefereeTeamAssignResult, RefereeTeamOption } from "../types/match";

/** Teams assigned to referee a match (spec 2026-09-10 referee teams §3.1). */

interface ApiEnvelope<T> {
  data: T;
  success: boolean;
  message: string;
}

const unique = (ids: string[]): string[] => Array.from(new Set(ids));

/** Teams that can referee at least one of these matches; teams already on all of theirs are left out. */
export const getRefereeTeamOptions = async (matchIds: string[]): Promise<RefereeTeamOption[]> => {
  const ids = unique(matchIds);
  if (ids.length === 0) return [];
  const response = await api.post<ApiEnvelope<RefereeTeamOption[]>>("/Referee/referee-team-options", { matchIds: ids });
  return response.data.data ?? [];
};

/**
 * Assigns every team to every match in one request. The server skips the pairs that aren't
 * allowed and says why, so the result has one entry per match.
 */
export const assignRefereeTeams = async (teamIds: string[], matchIds: string[]): Promise<RefereeTeamAssignResult[]> => {
  const teams = unique(teamIds);
  const matches = unique(matchIds);
  if (teams.length === 0 || matches.length === 0) return [];
  const response = await api.post<ApiEnvelope<RefereeTeamAssignResult[]>>("/Referee/referee-teams/assign", {
    teamIds: teams,
    matchIds: matches,
  });
  return response.data.data ?? [];
};

/** Removes a team from a match. A 404 means it is already gone, which is what was asked for. */
export const unassignRefereeTeam = async (matchId: string, teamId: string): Promise<void> => {
  try {
    await api.delete(`/Referee/matches/${encodeURIComponent(matchId)}/referee-teams/${encodeURIComponent(teamId)}`);
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) return;
    throw error;
  }
};
