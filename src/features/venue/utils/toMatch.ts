import { Match, TeamMember } from "../../matches/types/match";
import { VenueMatch, VenueMatchPlayer } from "../types/venue";

const toMember = (player: VenueMatchPlayer): TeamMember => ({
  id: player.id,
  teamMemberId: player.id,
  playerId: player.playerId,
  isCaptain: player.isCaptain,
  firstName: player.firstName,
  lastName: player.lastName,
  nationality: player.nationality,
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
    homeTeamMembers: venueMatch.homeTeamPlayers?.map(toMember) || [],
    awayTeamMembers: venueMatch.awayTeamPlayers?.map(toMember) || [],
    isCompleted: venueMatch.isCompleted,
  };
}
