import api from "../../../api/axios";
import {
  MatchFilters,
  MatchGameScore,
  PlayerSuggestion,
  RefereeMatchesResponse,
  UpdateMatchDTO,
  LiveScoreRequest,
  LiveScoreResponse,
} from "../types/match";

// Get referee matches
export const getRefereeMatches = (filters?: MatchFilters): Promise<{ data: RefereeMatchesResponse }> => {
  const params = new URLSearchParams();

  if (filters?.search) {
    params.append("search", filters.search);
  }
  if (filters?.status && filters.status !== "all") {
    params.append("status", filters.status);
  }
  if (filters?.tournament) {
    params.append("tournament", filters.tournament);
  }
  if (filters?.category && filters.category !== "all") {
    params.append("category", filters.category);
  }
  if (filters?.format && filters.format !== "all") {
    params.append("format", filters.format);
  }
  if (filters?.round && filters.round !== "all") {
    params.append("round", filters.round);
  }
  if (filters?.venue && filters.venue !== "all") {
    params.append("venue", filters.venue);
  }
  if (filters?.team && filters.team !== "all") {
    params.append("teamName", filters.team);
  }
  if (filters?.referee && filters.referee !== "all") {
    params.append("referee", filters.referee);
  }
  if (filters?.pageNumber) {
    params.append("pageNumber", filters.pageNumber.toString());
  }
  if (filters?.pageSize) {
    params.append("pageSize", filters.pageSize.toString());
  }

  const queryString = params.toString();
  const url = `/Referee/matches${queryString ? `?${queryString}` : ""}`;

  return api.get(url);
};

// Submit match result
export const submitMatchResult = (matchId: string, data: UpdateMatchDTO) =>
  api.post(`/Referee/matches/${matchId}/result`, data);

// Update match
export const updateMatch = (matchId: string, data: UpdateMatchDTO) =>
  api.patch(`/Referee/matches/${matchId}/update`, data);

export const updateGroupMatch = (matchId: string, data: UpdateMatchDTO) => api.put(`/Group/match/${matchId}`, data);

export const updateLeagueMatch = (matchId: string, data: UpdateMatchDTO) => api.put(`/League/match/${matchId}`, data);

export const updateKnockoutMatch = (matchId: string, data: UpdateMatchDTO) =>
  api.put(`/Knockout/match/${matchId}`, data);

export const assignRefereeToMatch = (refereeId: string, matchId: string) =>
  api.post(`/Referee/${refereeId}/assign/${matchId}`);

export const bulkAssignRefereeToMatches = async (refereeId: string, matchIds: string[]) => {
  const promises = matchIds.map((matchId) => assignRefereeToMatch(refereeId, matchId));
  const results = await Promise.allSettled(promises);

  // Check if any assignments failed
  const failedAssignments = results.filter((result) => result.status === "rejected");

  if (failedAssignments.length > 0) {
    throw new Error(`${failedAssignments.length} assignment(s) failed`);
  }

  return results.map((result) => (result as PromiseFulfilledResult<any>).value);
};

export const unassignRefereeFromMatch = (refereeId: string, matchId: string) =>
  api.delete(`/Referee/${refereeId}/unassign/${matchId}`);

export const getPlayerSuggestions = (search?: string): Promise<{ data: { data: PlayerSuggestion[] } }> =>
  api.get(`/Player/suggestions/all${search ? `?search=${encodeURIComponent(search)}` : ""}`);

export const bulkUpdateMatchScores = async (matchScores: { matchId: string; gameScores: MatchGameScore[] }[]) => {
  const promises = matchScores.map(({ matchId, gameScores }) => {
    const data = { gameScores };
    return { matchId, data };
  });

  return promises;
};

// Live score logging
export const updateLiveScore = (
  data: LiveScoreRequest,
  venueAccessToken?: string
): Promise<{ data: LiveScoreResponse }> => {
  const headers = venueAccessToken ? { "X-Venue-Access-Token": venueAccessToken } : {};
  return api.put("/tournament/matches/live-score", data, { headers });
};
