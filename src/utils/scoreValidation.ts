import { Match, MatchGameScore, isFixedPointsFormat } from "../features/matches/types/match";
import { ScoreCell } from "./matchScoreCells";

/**
 * The one set of score rules, shared by the single-match dialog (UpdateScoreDialog) and the
 * bulk score sheet (BulkUpdateScoreModal), so the two can never disagree about what a valid
 * score is. `null` in a cell means "left blank".
 */

const isStarted = (cell: ScoreCell): boolean => cell.home !== null || cell.away !== null;

/** Games with both sides entered — the only ones that get saved. */
export const filledCells = (cells: ScoreCell[]): ScoreCell[] =>
  cells.filter((cell) => cell.home !== null && cell.away !== null);

export const hasAnyScore = (cells: ScoreCell[]): boolean => cells.some(isStarted);

export const sameCells = (a: ScoreCell[], b: ScoreCell[]): boolean =>
  a.length === b.length && a.every((cell, index) => cell.home === b[index].home && cell.away === b[index].away);

/**
 * Problems that would stop these scores being saved; empty means they're fine.
 * Nothing entered at all is not an error here — each caller decides what "empty" means.
 */
export const validateGameScores = (match: Match, cells: ScoreCell[]): string[] => {
  const errors: string[] = [];

  cells.forEach((cell, index) => {
    if ((cell.home === null) !== (cell.away === null)) {
      errors.push(`Game ${index + 1} needs both scores.`);
    }
  });

  const lastStarted = cells.map(isStarted).lastIndexOf(true);
  cells.slice(0, Math.max(lastStarted, 0)).forEach((cell, index) => {
    if (!isStarted(cell)) errors.push(`Game ${index + 1} is empty but a later game has a score.`);
  });

  const complete = filledCells(cells);

  if (isFixedPointsFormat(match.formatType)) {
    // Americano/Mexicano: a single game to a fixed points total; ties are legal.
    if (complete.length > 1) {
      errors.push("This match is a single game — enter one score pair only.");
    }
    const target = match.pointsPerMatch;
    if (complete.length === 1 && typeof target === "number" && target > 0) {
      const total = (complete[0].home ?? 0) + (complete[0].away ?? 0);
      if (total !== target) errors.push(`Total points must equal ${target} (currently ${total}).`);
    }
    return errors;
  }

  const drawsAllowed = (match.pointsForDraw ?? 0) > 0;
  if (!drawsAllowed) {
    cells.forEach((cell, index) => {
      if (cell.home !== null && cell.away !== null && cell.home === cell.away) {
        errors.push(`Game ${index + 1} cannot end in a tie.`);
      }
    });
  }

  return errors;
};

/** The dialog stores "not played" as 0–0. Anything else keeps both sides, so a 21–0 game survives. */
export const cellsFromGameScores = (gameScores: MatchGameScore[]): ScoreCell[] =>
  gameScores.map((score, index) => {
    const blank = score.homeScore === 0 && score.awayScore === 0;
    return {
      gameNumber: score.gameNumber ?? index + 1,
      home: blank ? null : score.homeScore,
      away: blank ? null : score.awayScore,
    };
  });

/** What goes to the API: complete pairs only, with their game numbers. */
export const gameScoresFromCells = (cells: ScoreCell[]): MatchGameScore[] =>
  filledCells(cells).map((cell) => ({
    gameNumber: cell.gameNumber,
    homeScore: cell.home as number,
    awayScore: cell.away as number,
  }));
