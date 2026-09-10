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
  // One `venues` entry per venue rather than a CSV: venue names are free text and
  // may contain commas. A single venue keeps using the original `venue` param.
  if (filters?.venues && filters.venues.length > 0) {
    filters.venues.forEach((venue) => params.append("venues", venue));
  } else if (filters?.venue && filters.venue !== "all") {
    params.append("venue", filters.venue);
  }
  if (filters?.team && filters.team !== "all") {
    params.append("teamName", filters.team);
  }
  if (filters?.referee && filters.referee !== "all") {
    params.append("referee", filters.referee);
  }
  if (filters?.date && filters.date !== "all") {
    params.append("date", filters.date);
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

export const updateAmericanoMatch = (matchId: string, data: UpdateMatchDTO) =>
  api.put(`/Americano/match/${matchId}`, data);

export const updateMexicanoMatch = (matchId: string, data: UpdateMatchDTO) =>
  api.put(`/Mexicano/match/${matchId}`, data);

export class UnknownMatchFormatError extends Error {
  readonly formatType: string | undefined;

  constructor(formatType: string | undefined) {
    super(`Cannot save scores: unknown match format "${formatType ?? ""}".`);
    this.name = "UnknownMatchFormatError";
    this.formatType = formatType;
    Object.setPrototypeOf(this, UnknownMatchFormatError.prototype);
  }
}

/**
 * Saves a match through its own format's endpoint, so standings and brackets update exactly
 * as that format expects. An unknown format is refused rather than guessed at.
 */
export const updateMatchByFormat = (
  formatType: string | undefined,
  matchId: string,
  data: UpdateMatchDTO
): Promise<unknown> => {
  switch (formatType) {
    case "Group":
      return updateGroupMatch(matchId, data);
    case "League":
      return updateLeagueMatch(matchId, data);
    case "Knockout":
      return updateKnockoutMatch(matchId, data);
    case "Americano":
      return updateAmericanoMatch(matchId, data);
    case "Mexicano":
      return updateMexicanoMatch(matchId, data);
    default:
      return Promise.reject(new UnknownMatchFormatError(formatType));
  }
};

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

/** Guest credentials for live scoring. Signed-in referees send neither. */
export interface GuestAccessTokens {
  venueAccessToken?: string;
  matchAccessToken?: string;
}

// Live score logging
export const updateLiveScore = (
  data: LiveScoreRequest,
  access: GuestAccessTokens = {}
): Promise<{ data: LiveScoreResponse }> => {
  const headers: Record<string, string> = {};
  if (access.venueAccessToken) headers["X-Venue-Access-Token"] = access.venueAccessToken;
  if (access.matchAccessToken) headers["X-Match-Access-Token"] = access.matchAccessToken;
  return api.put("/tournament/matches/live-score", data, { headers });
};
