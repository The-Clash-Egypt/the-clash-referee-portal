import { Match, TeamMember, isFixedPointsFormat } from "../types/match";
import { isLive } from "./timeline";

/** done = an earlier set (muted), current = the set being played (red), final = a finished match's score. */
export type ScoreState = "done" | "current" | "final";

export interface ScoreCell {
  key: string;
  home: number;
  away: number;
  state: ScoreState;
}

const sortedGames = (match: Match) => (match.gameScores ?? []).slice().sort((a, b) => a.gameNumber - b.gameNumber);

/** Americano/Mexicano: one game to a points total, so its points are the score (the games won are just 1/0). */
const pointsGame = (match: Match) => {
  const games = match.gameScores ?? [];
  return games.find((game) => game.gameNumber === 1) ?? games[0];
};

/**
 * The scores to show for a match, one cell per column: the points for Americano/Mexicano, else each set (the last one
 * is current while the match is live). A finished match without set scores shows its result.
 */
export function scoreCells(match: Match): ScoreCell[] {
  const live = isLive(match);
  const stateOf = (current: boolean): ScoreState => (current ? "current" : match.isCompleted ? "final" : "done");

  if (isFixedPointsFormat(match.formatType)) {
    const game = pointsGame(match);
    return game ? [{ key: "points", home: game.homeScore, away: game.awayScore, state: stateOf(live) }] : [];
  }

  const games = sortedGames(match);
  if (games.length === 0) {
    if (match.isCompleted && typeof match.homeScore === "number" && typeof match.awayScore === "number") {
      return [{ key: "result", home: match.homeScore, away: match.awayScore, state: "final" }];
    }
    return [];
  }
  return games.map((game, index) => ({
    key: `set-${game.gameNumber}`,
    home: game.homeScore,
    away: game.awayScore,
    state: stateOf(live && index === games.length - 1),
  }));
}

/** Sets won by each side of a sets match (the API's homeScore/awayScore, else counted from the sets). */
export function setsWon(match: Match): { home: number; away: number } | null {
  if (isFixedPointsFormat(match.formatType)) return null;
  if (typeof match.homeScore === "number" && typeof match.awayScore === "number") {
    return { home: match.homeScore, away: match.awayScore };
  }
  const games = sortedGames(match);
  if (games.length === 0) return null;
  return games.reduce(
    (won, game) => ({
      home: won.home + (game.homeScore > game.awayScore ? 1 : 0),
      away: won.away + (game.awayScore > game.homeScore ? 1 : 0),
    }),
    { home: 0, away: 0 }
  );
}

/** Who won a finished match; null while it isn't finished, or for a draw. */
export function matchWinner(match: Match): "home" | "away" | null {
  if (!match.isCompleted) return null;
  let home: number | undefined;
  let away: number | undefined;
  const game = isFixedPointsFormat(match.formatType) ? pointsGame(match) : undefined;
  if (game) {
    home = game.homeScore;
    away = game.awayScore;
  } else {
    const won = setsWon(match);
    home = won?.home;
    away = won?.away;
  }
  if (home === undefined || away === undefined || home === away) return null;
  return home > away ? "home" : "away";
}

/** "Live · Set 2" (the set being played), or "Live" for a points game. */
export function liveTagLabel(match: Match): string {
  if (isFixedPointsFormat(match.formatType)) return "Live";
  const games = match.gameScores ?? [];
  const set = games.length > 0 ? Math.max(...games.map((game) => game.gameNumber || 0), games.length) : 1;
  return `Live · Set ${set}`;
}

/** "Men's Open · Round of 16" */
export const categoryAndRound = (match: Match): string => [match.categoryName, match.round].filter(Boolean).join(" · ");

/** "Ahmed Kamal" => "Ahmed K." (a row has little room). */
export function shortPersonName(fullName?: string | null): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

/** Who referees a match, in short: the people ("Ahmed K.") then the referee teams. Empty = nobody yet. */
export const refereeSummary = (match: Match): string[] =>
  [
    ...(match.referees ?? []).map((referee) => shortPersonName(referee.fullName)),
    ...(match.refereeTeams ?? []).map((team) => team.teamName),
  ].filter(Boolean);

/** "AK" for "Ahmed Kamal". */
export function initials(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/** "Ali Hassan (C) · Karim Mostafa" (the captain marked, as on the old match card) */
export const playersLine = (members?: TeamMember[] | null): string =>
  (members ?? [])
    .map((member) => {
      const name = `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim();
      return name && member.isCaptain ? `${name} (C)` : name;
    })
    .filter(Boolean)
    .join(" · ");
