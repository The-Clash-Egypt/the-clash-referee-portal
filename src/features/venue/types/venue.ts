export interface VenueMatch {
  id: string;
  categoryName: string;
  formatName: string;
  formatType: string;
  round: string;
  startTime: string;
  venue: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  bestOf: number;
  winnerTeamId: string;
  homeTeamSets: number;
  awayTeamSets: number;
  isCompleted: boolean;
  gameScores: VenueMatchGameScore[];
}

export interface VenueMatchGameScore {
  gameNumber: number;
  homeScore: number;
  awayScore: number;
}

export interface Venue {
  id: string;
  name: string;
  password?: string | null;
  accessToken?: string | null;
  accessTokenExpiry?: string | null;
  isLocked: boolean;
  tournamentId: string;
  tournamentName?: string;
  createdAt: string;
  totalMatchCount?: number;
  completedMatchCount?: number;
  matches?: VenueMatch[];
}

export interface CreateVenueDTO {
  name: string;
  password?: string;
  accessToken?: string;
  isLocked?: boolean;
  tournamentId: string;
  // Optional fields that might be added later
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  capacity?: number;
  description?: string;
}

export interface UpdateVenueDTO {
  name: string;
  password?: string;
  accessToken?: string;
  isLocked?: boolean;
  // Optional fields that might be added later
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  capacity?: number;
  description?: string;
  isActive?: boolean;
}

export interface VenueFilterDTO {
  search?: string;
  tournamentId?: string;
  locked?: boolean;
  pageNumber?: number;
  pageSize?: number;
  // Optional fields that might be added later
  city?: string;
  state?: string;
  country?: string;
  isActive?: boolean;
}

export interface VenueListResponse {
  data: Venue[];
  success: boolean;
  message: string;
  errors: string[];
}

export interface VenueResponse {
  data: Venue;
  success: boolean;
  message: string;
  errors: string[];
}

export interface VenueDetailResponse {
  data: {
    id: string;
    name: string;
    password: string;
    accessToken: string;
    isLocked: boolean;
    tournamentId: string;
    tournamentName: string;
    createdAt: string;
    matches: VenueMatch[];
  };
  success: boolean;
  message: string;
  errors: string[];
}

export interface VenueFilters {
  search?: string;
  tournamentId?: string;
  locked?: boolean;
  pageNumber?: number;
  pageSize?: number;
  // Optional fields that might be added later
  city?: string;
  state?: string;
  country?: string;
  isActive?: boolean;
}
