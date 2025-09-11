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
  teams: (string | { id: string; name?: string; fullName?: string })[];
  referees: (string | { id: string; fullName?: string; name?: string })[];
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
  team?: string;
  referee?: string;
  pageNumber?: number;
  pageSize?: number;
}

export interface PlayerSuggestion {
  id: string;
  firstName: string;
  lastName: string;
  nationality: string;
  gender: string;
  email: string;
  userId: string;
}

// The API returns PlayerSuggestion[] directly, not wrapped in a response object
