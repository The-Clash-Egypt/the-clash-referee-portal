import api from "../../../api/axios";

export interface Team {
  id: string;
  name: string;
  // Add other team properties as needed
}

export interface MatchGameScore {
  gameNumber: number;
  homeScore: number;
  awayScore: number;
}

export interface Match {
  id: string;
  venue?: string;
  tournamentName?: string;
  categoryName?: string;
  format?: string;
  bestOf?: number;
  startTime?: string;
  round?: string;
  homeTeamId?: string;
  homeTeamName?: string;
  awayTeamId?: string;
  awayTeamName?: string;
  homeScore?: number;
  awayScore?: number;
  gameScores?: MatchGameScore[];
  referees?: Referee[];
  isCompleted: boolean;
}

export interface MatchReferee {
  id: string;
  refereeId: string;
  referee: Referee;
  matchId: string;
  match: Match;
  assignedAt: string;
}

export interface Referee {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
}

export interface User {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
}

export interface GameScoreDTO {
  gameNumber: number;
  homeScore: number;
  awayScore: number;
}

export interface UpdateMatchDTO {
  gameScores?: GameScoreDTO[];
}

export interface PaginationInfo {
  total: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: {
    items: T[];
    pagination: PaginationInfo;
  };
  success: boolean;
  message: string;
  errors: string[];
}

export interface FilterOptions {
  tournaments: string[];
  categories: string[];
  formats: string[];
  rounds: string[];
  venues: string[];
}

export interface AdminMatchesResponse {
  data: {
    matches: {
      items: Match[];
      pagination: PaginationInfo;
    };
    inProgressCount: number;
    incomingCount: number;
    completedCount: number;
    filters: FilterOptions;
  };
  success: boolean;
  message: string;
  errors: string[];
}

export interface RefereeMatchesResponse {
  data: {
    matches: {
      items: Match[];
      pagination: PaginationInfo;
    };
    inProgressCount: number;
    incomingCount: number;
    completedCount: number;
    filters: FilterOptions;
  };
  success: boolean;
  message: string;
  errors: string[];
}

export interface MatchFilters {
  search?: string;
  status?: "all" | "completed" | "in-progress" | "upcoming";
  tournament?: string;
  category?: string;
  format?: string;
  round?: string;
  venue?: string;
  pageNumber?: number;
  pageSize?: number;
}

// Get referee matches
export const getRefereeMatches = (filters?: MatchFilters): Promise<{ data: RefereeMatchesResponse }> => {
  const params = new URLSearchParams();

  if (filters?.search) {
    params.append("search", filters.search);
  }
  if (filters?.status && filters.status !== "all") {
    params.append("status", filters.status);
  }
  if (filters?.tournament && filters.tournament !== "all") {
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
