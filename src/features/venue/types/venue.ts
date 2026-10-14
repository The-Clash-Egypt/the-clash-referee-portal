import { MatchSideUnit } from "../../matches/types/match";

/** A court match's player, names only: the court page never gets player ids, nationality or notes. */
export interface VenueMatchPlayer {
  firstName: string;
  lastName: string;
  isCaptain: boolean;
}

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
  homeTeam2Id?: string | null;
  homeTeam2Name?: string | null;
  awayTeam2Id?: string | null;
  awayTeam2Name?: string | null;
  /** Units 3+ of each side (Roulette), in slot order. Older servers leave them out. */
  homeExtraUnits?: MatchSideUnit[];
  awayExtraUnits?: MatchSideUnit[];
  pointsPerMatch?: number | null;
  bestOf: number;
  winnerTeamId: string;
  homeTeamSets: number;
  awayTeamSets: number;
  isCompleted: boolean;
  gameScores: VenueMatchGameScore[];
  homeTeamPlayers?: VenueMatchPlayer[];
  awayTeamPlayers?: VenueMatchPlayer[];
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

/**
 * The public court page's court, from POST /venue/{id}/access once the server has checked the QR token, the lock
 * and the password. It never carries the court's password or access token.
 */
export interface GuestCourt {
  id: string;
  name: string;
  tournamentName: string;
  /** The court has a password: it goes with every final score (X-Venue-Password). */
  requiresPassword: boolean;
  matches: VenueMatch[];
}

/** Why the API refused the court page (403 unless noted). */
export type CourtAccessReason =
  | "invalid"
  | "expired"
  | "locked"
  | "password-required"
  | "wrong-password"
  | "wrong-court"
  | "not-found" // 404
  | "completed" // 409
  | "unsupported-format" // 400
  | "rejected"; // 400

export interface CourtAccessDenial {
  reason: CourtAccessReason;
  message: string;
  /** Sent once the token checked out (locked, password-required, wrong-password), so the page can name the court. */
  name?: string | null;
  tournamentName?: string | null;
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
