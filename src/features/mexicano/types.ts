import { Match, MatchGameScore } from "../matches/types/match";

/** AmericanoTeams.CheckInStatus on the server (spec 2026-09-29). Sent and received as a number. */
export enum MexicanoStatus {
  NotHere = 0,
  Playing = 1,
  /** Sits out the next round only; the server sets it back to Playing once that round starts. */
  SitOut = 2,
}

export interface MexicanoPlayer {
  teamId: string;
  /** The unit's name; for single-player units this is the player's name. */
  name: string;
  members: string[];
  status: MexicanoStatus;
  rank: number;
  points: number;
  played: number;
  sitOuts: number;
  /** In any match (or refereeing one): the unit can no longer be broken up. */
  hasMatches: boolean;
}

export interface MexicanoRound {
  number: number;
  /** Court order, Court 1 first. Same shape as the Referee/matches items. */
  matches: Match[];
  /** Units checked in now that are in no match of this round. */
  sittingOut: string[];
}

/** An individually registered player not in a unit yet (unit size ≥ 2). memberId is the TeamMember id. */
export interface UnpairedPlayer {
  memberId: string;
  name: string;
}

/** GET Mexicano/session: everything the Mexicano page shows. */
export interface MexicanoSession {
  formatId: string;
  tournamentId: string;
  categoryName: string;
  stageName: string;
  plannedRounds: number;
  courts: number | null;
  pointsPerMatch: number;
  unitSize: number;
  /** 0 before round 1. */
  currentRound: number;
  currentRoundScored: number;
  currentRoundTotal: number;
  ended: boolean;
  canStartNextRound: boolean;
  nextRoundBlockedReason: string | null;
  canUndoRound: boolean;
  canFinish: boolean;
  /** Leaderboard order. */
  players: MexicanoPlayer[];
  rounds: MexicanoRound[];
  /** Individually registered players not in a unit yet. Empty when unitSize is 1. */
  unpaired: UnpairedPlayer[];
}

/** The stages run as rounds of one points game: the block types GET Tournament/{id}/formats names them by. */
export type StageKind = "Mexicano" | "Americano" | "Roulette";

/** Drawn live, a round at a time, in the runner (Americano draws every round up front instead). */
export const isLiveStageKind = (kind: StageKind): boolean => kind === "Mexicano" || kind === "Roulette";

/** An Americano, Mexicano or Roulette stage of a tournament, as listed on its stages tab. */
export interface TournamentStage {
  kind: StageKind;
  formatId: string;
  categoryName: string;
  /** The stage's own name, else its kind ("Mexicano" / "Americano" / "Roulette"). */
  stageName: string;
  /** The server's completion rule: every planned round played and scored. Null when it didn't say. */
  isEnded: boolean | null;
}

/** An item of GET Americano/matches: the stage's whole schedule (Americano draws every round up front). */
export interface AmericanoMatch {
  id: string;
  /** "Round 3" */
  round?: string | null;
  isCompleted: boolean;
  gameScores?: MatchGameScore[] | null;
  venue?: string | null;
  startTime?: string | null;
}

/** POST Americano/finish: what finishing early did. */
export interface AmericanoFinishResult {
  roundsPlayed: number;
  matchesRemoved: number;
}
