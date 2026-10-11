import api from "../../../api/axios";
import { MatchGameScore } from "../../matches/types/match";
import {
  CourtAccessDenial,
  CourtAccessReason,
  CreateVenueDTO,
  GuestCourt,
  UpdateVenueDTO,
  VenueFilterDTO,
  VenueListResponse,
  VenueResponse,
} from "../types/venue";

// Get all venues
export const getAllVenues = (): Promise<{ data: VenueListResponse }> => {
  return api.get("/venue");
};

// Get venue by ID (admins only: it carries the court's password and access token)
export const getVenueById = (id: string): Promise<{ data: VenueResponse }> => {
  return api.get(`/venue/${id}`);
};

// Get venues by tournament ID
export const getVenuesByTournamentId = (tournamentId: string): Promise<{ data: VenueListResponse }> => {
  return api.get(`/venue/tournament/${tournamentId}`);
};

// Create venue
export const createVenue = (data: CreateVenueDTO): Promise<{ data: VenueResponse }> => {
  return api.post("/venue", data);
};

// Update venue
export const updateVenue = (id: string, data: UpdateVenueDTO): Promise<{ data: VenueResponse }> => {
  return api.put(`/venue/${id}`, data);
};

// Delete venue
export const deleteVenue = (id: string): Promise<{ data: VenueResponse }> => {
  return api.delete(`/venue/${id}`);
};

// Search venues
export const searchVenues = (searchTerm: string): Promise<{ data: VenueListResponse }> => {
  return api.get(`/venue/search?searchTerm=${encodeURIComponent(searchTerm)}`);
};

// Get filtered venues
export const getFilteredVenues = (filters: VenueFilterDTO): Promise<{ data: VenueListResponse }> => {
  const params = new URLSearchParams();

  if (filters.search) {
    params.append("searchTerm", filters.search);
  }
  if (filters.tournamentId) {
    params.append("tournamentId", filters.tournamentId);
  }
  if (filters.locked) {
    params.append("locked", filters.locked.toString());
  }

  const queryString = params.toString();
  const url = `/venue/filter/summary${queryString ? `?${queryString}` : ""}`;

  return api.get(url);
};

// Generate access token for venue
export const generateVenueToken = (
  venueId: string,
  forceNew: boolean = false
): Promise<{ data: { data: string; success: boolean; message: string; errors: string[] } }> => {
  return api.post(`/venue/${venueId}/generate-token`, { forceNew });
};

// ── The public court page (/venue/shared) ──
// The server checks the court QR's token, the court's lock and its password on every call; the page never sees
// the court's password or token beyond what the guest already holds.

export const COURT_TOKEN_HEADER = "X-Venue-Access-Token";
export const COURT_PASSWORD_HEADER = "X-Venue-Password";

interface ApiEnvelope<T> {
  data: T;
  success: boolean;
  message: string;
}

// The id comes from the QR link's query string, so it is encoded before it goes into a path.
const courtPath = (venueId: string) => `/venue/${encodeURIComponent(venueId)}`;

/** Opens the court: rejects with a 403 the page reads through courtAccessDenial when the server refuses. */
export const openCourt = async (venueId: string, token: string, password?: string): Promise<GuestCourt> => {
  const body = password === undefined ? { token } : { token, password };
  const response = await api.post<ApiEnvelope<GuestCourt>>(`${courtPath(venueId)}/access`, body);
  return response.data.data;
};

export interface CourtAccess {
  token: string;
  /** The password the court was opened with, when it has one. */
  password?: string;
}

/** Saves a match's final score on this court (scores only). */
export const submitCourtScore = async (
  venueId: string,
  matchId: string,
  access: CourtAccess,
  gameScores: MatchGameScore[]
): Promise<boolean> => {
  const headers: Record<string, string> = { [COURT_TOKEN_HEADER]: access.token };
  // Headers carry Latin-1 only; the API decodes this.
  if (access.password) headers[COURT_PASSWORD_HEADER] = encodeURIComponent(access.password);
  const response = await api.put<ApiEnvelope<boolean>>(
    `${courtPath(venueId)}/matches/${encodeURIComponent(matchId)}/score`,
    { gameScores },
    { headers }
  );
  return response.data.data;
};

type HttpFailure = {
  response?: { status?: number; data?: { reason?: string; message?: string; name?: string | null; tournamentName?: string | null } };
};

const COURT_REASONS: CourtAccessReason[] = [
  "invalid",
  "expired",
  "locked",
  "password-required",
  "wrong-password",
  "wrong-court",
  "not-found",
  "completed",
  "unsupported-format",
  "rejected",
];

/** The server's refusal of a court page call, or null for a network or unexplained server failure. */
export const courtAccessDenial = (error: unknown): CourtAccessDenial | null => {
  const data = (error as HttpFailure)?.response?.data;
  const reason = data?.reason as CourtAccessReason | undefined;
  if (!reason || !COURT_REASONS.includes(reason)) return null;
  return { reason, message: data?.message ?? "", name: data?.name ?? null, tournamentName: data?.tournamentName ?? null };
};
