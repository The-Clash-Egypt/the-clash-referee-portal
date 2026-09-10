import api from "../../../api/axios";
import { Match, MatchGameScore, TeamMember } from "../types/match";

/** Guest access to a single match through its QR code (spec 2026-09-10 §4.1). */

export const MATCH_ACCESS_HEADER = "X-Match-Access-Token";

/** The API accepts at most this many match ids per token request. */
export const MAX_TOKENS_PER_REQUEST = 1000;

export interface MatchAccessToken {
  matchId: string;
  token: string;
  expiresAt: string;
}

export interface GuestMatchPlayer {
  firstName: string;
  lastName: string;
  isCaptain: boolean;
}

export interface GuestMatch {
  id: string;
  tournamentName: string;
  categoryName: string;
  formatName: string;
  formatType: string;
  round?: string | null;
  venue?: string | null;
  startTime?: string | null;
  bestOf: number;
  pointsPerMatch?: number | null;
  pointsForDraw?: number | null;
  isCompleted: boolean;
  homeTeamName?: string | null;
  awayTeamName?: string | null;
  homeTeam2Name?: string | null;
  awayTeam2Name?: string | null;
  homeTeamSets: number;
  awayTeamSets: number;
  gameScores: MatchGameScore[];
  homeTeamPlayers: GuestMatchPlayer[];
  awayTeamPlayers: GuestMatchPlayer[];
  expiresAt?: string | null;
}

interface ApiEnvelope<T> {
  data: T;
  success: boolean;
  message: string;
}

const guestHeaders = (token: string) => ({ headers: { [MATCH_ACCESS_HEADER]: token } });

/** Mints one 24h token per match, chunked so any report size stays under the API's cap. */
export const issueMatchAccessTokens = async (matchIds: string[]): Promise<MatchAccessToken[]> => {
  const unique = Array.from(new Set(matchIds));
  const tokens: MatchAccessToken[] = [];

  for (let start = 0; start < unique.length; start += MAX_TOKENS_PER_REQUEST) {
    const matchIdsChunk = unique.slice(start, start + MAX_TOKENS_PER_REQUEST);
    const response = await api.post<ApiEnvelope<MatchAccessToken[]>>("/MatchAccess/tokens", {
      matchIds: matchIdsChunk,
    });
    tokens.push(...(response.data.data ?? []));
  }

  return tokens;
};

export const getGuestMatch = async (matchId: string, token: string): Promise<GuestMatch> => {
  const response = await api.get<ApiEnvelope<GuestMatch>>(`/MatchAccess/${matchId}`, guestHeaders(token));
  return response.data.data;
};

export const submitGuestMatchScore = async (
  matchId: string,
  token: string,
  gameScores: MatchGameScore[]
): Promise<GuestMatch> => {
  const response = await api.put<ApiEnvelope<GuestMatch>>(
    `/MatchAccess/${matchId}/score`,
    { gameScores },
    guestHeaders(token)
  );
  return response.data.data;
};

/** The link a match QR encodes. Uses the portal's own origin, exactly like venue links. */
export const buildMatchAccessUrl = (matchId: string, token: string, origin: string = window.location.origin): string =>
  `${origin}/match/shared?matchId=${encodeURIComponent(matchId)}&token=${encodeURIComponent(token)}`;

export type GuestAccessErrorReason = "invalid" | "expired" | "completed" | "not-found" | "network" | "unknown";

type HttpFailure = { response?: { status?: number; data?: { reason?: string; message?: string } } };

export const guestAccessErrorReason = (error: unknown): GuestAccessErrorReason => {
  const response = (error as HttpFailure)?.response;
  if (!response) return "network";

  const reason = response.data?.reason;
  if (reason === "invalid" || reason === "expired" || reason === "completed" || reason === "not-found") {
    return reason;
  }
  if (response.status === 404) return "not-found";
  if (response.status === 409) return "completed";
  if (response.status === 403) return "invalid";
  return "unknown";
};

/** The server's explanation for a rejected save, when it sent one. */
export const guestAccessErrorMessage = (error: unknown): string | undefined =>
  (error as HttpFailure)?.response?.data?.message || undefined;

const toMember = (player: GuestMatchPlayer, key: string): TeamMember => ({
  id: key,
  teamMemberId: key,
  playerId: "",
  isCaptain: player.isCaptain,
  firstName: player.firstName,
  lastName: player.lastName,
  nationality: "",
  gender: "",
  registrationStatus: "",
  paymentStatus: "",
  consent: false,
  addedAt: "",
  phoneNumber: "",
  email: "",
});

/** Adapts the guest payload to the portal's Match so MatchCard and UpdateScoreDialog can render it. */
export const guestMatchToMatch = (guest: GuestMatch): Match => ({
  id: guest.id,
  tournamentName: guest.tournamentName,
  categoryName: guest.categoryName,
  format: guest.formatName || guest.formatType,
  formatType: guest.formatType,
  bestOf: guest.bestOf,
  pointsPerMatch: guest.pointsPerMatch ?? null,
  pointsForDraw: guest.pointsForDraw ?? null,
  startTime: guest.startTime ?? undefined,
  round: guest.round ?? undefined,
  venue: guest.venue ?? undefined,
  homeTeamName: guest.homeTeamName ?? undefined,
  awayTeamName: guest.awayTeamName ?? undefined,
  homeTeam2Name: guest.homeTeam2Name ?? null,
  awayTeam2Name: guest.awayTeam2Name ?? null,
  homeScore: guest.homeTeamSets,
  awayScore: guest.awayTeamSets,
  gameScores: guest.gameScores,
  referees: [],
  homeTeamMembers: guest.homeTeamPlayers.map((player, index) => toMember(player, `home-${index}`)),
  awayTeamMembers: guest.awayTeamPlayers.map((player, index) => toMember(player, `away-${index}`)),
  isCompleted: guest.isCompleted,
});
