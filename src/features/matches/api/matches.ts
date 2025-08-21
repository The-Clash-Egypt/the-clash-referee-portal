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

// Get referee matches
export const getRefereeMatches = (): Promise<{ data: Match[] }> => api.get("/Referee/matches");

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
