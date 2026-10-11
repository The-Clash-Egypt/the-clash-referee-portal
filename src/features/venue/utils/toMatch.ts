import { Match, TeamMember } from "../../matches/types/match";
import { VenueMatch, VenueMatchPlayer } from "../types/venue";

// The court payload names players only, so the member ids are synthetic (as on the match QR page).
const toMember = (player: VenueMatchPlayer, key: string): TeamMember => ({
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

/**
 * A court's match (the public court page's payload) as the portal's Match, so the court page can show it as a timeline
 * row (MatchRow) and score it (UpdateScoreDialog). The court's payload names no referees and no tournament.
 */
export function venueMatchToMatch(venueMatch: VenueMatch): Match {
  return {
    id: venueMatch.id,
    venue: venueMatch.venue,
    tournamentName: undefined,
    categoryName: venueMatch.categoryName,
    format: venueMatch.formatName ? venueMatch.formatName : venueMatch.formatType,
    formatType: venueMatch.formatType,
    bestOf: venueMatch.bestOf,
    pointsPerMatch: venueMatch.pointsPerMatch ?? null,
    startTime: venueMatch.startTime,
    round: venueMatch.round,
    homeTeamId: venueMatch.homeTeamId,
    homeTeamName: venueMatch.homeTeamName,
    awayTeamId: venueMatch.awayTeamId,
    awayTeamName: venueMatch.awayTeamName,
    homeTeam2Id: venueMatch.homeTeam2Id ?? null,
    homeTeam2Name: venueMatch.homeTeam2Name ?? null,
    awayTeam2Id: venueMatch.awayTeam2Id ?? null,
    awayTeam2Name: venueMatch.awayTeam2Name ?? null,
    homeScore: venueMatch.homeTeamSets,
    awayScore: venueMatch.awayTeamSets,
    gameScores: (venueMatch.gameScores ?? []).map((game) => ({
      gameNumber: game.gameNumber,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
    })),
    referees: [],
    homeTeamMembers: venueMatch.homeTeamPlayers?.map((player, index) => toMember(player, `home-${index}`)) || [],
    awayTeamMembers: venueMatch.awayTeamPlayers?.map((player, index) => toMember(player, `away-${index}`)) || [],
    isCompleted: venueMatch.isCompleted,
  };
}
