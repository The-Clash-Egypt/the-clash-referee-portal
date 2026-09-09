import { Match } from "../features/matches/types/match";

/** One game's box pair on the score grid. `null` means "blank, fill in by hand". */
export interface ScoreCell {
  gameNumber: number;
  home: number | null;
  away: number | null;
}

/** Cells typed into the preview but not yet saved, keyed by match id. */
export type ScoreDrafts = Record<string, ScoreCell[]>;

/** Geometry of the score grid, in PDF points. The HTML sheet uses the same numbers. */
export const SCORE_COLUMN_WIDTH = 150;
export const SCORE_CELL_MAX_WIDTH = 25;
export const SCORE_CELL_HEIGHT = 16;
export const SCORE_GRID_BORDER = 0.75;

/**
 * Cells shrink once there are enough games that the grid would overflow the score
 * column: 6 games at full width would be 6 * 25 + 1.5 = 151.5pt against a 150pt column.
 */
export const scoreCellWidth = (cellCount: number): number => {
  const usable = SCORE_COLUMN_WIDTH - 2 * SCORE_GRID_BORDER;
  return Math.min(SCORE_CELL_MAX_WIDTH, usable / Math.max(cellCount, 1));
};

/**
 * The single source of truth for how many score boxes a match shows and what is in
 * them. Imported by both the PDF document and the HTML preview so the two cannot
 * disagree about a match's score grid.
 *
 * `draft` is a set of cells typed into the preview but not yet saved. When one is
 * supplied it wins outright, so the sheet on screen, the browser print and the PDF
 * all draw the same grid — including the boxes still waiting to be filled in.
 */
export const scoreCellsFor = (match: Match, draft?: ScoreCell[]): ScoreCell[] => {
  if (draft && draft.length > 0) return draft;

  const games = match.gameScores ?? [];

  if (match.isCompleted) {
    if (games.length > 0) {
      return games.map((game, index) => ({
        gameNumber: game.gameNumber ?? index + 1,
        home: game.homeScore ?? null,
        away: game.awayScore ?? null,
      }));
    }

    // A completed match with only an aggregate score still deserves one filled box.
    if (match.homeScore !== undefined && match.awayScore !== undefined) {
      return [{ gameNumber: 1, home: match.homeScore, away: match.awayScore }];
    }
  }

  // A match still to be played — or under way — always shows a box per game of the
  // best-of, seeded with whatever has been recorded, so there is somewhere to write
  // the remaining games.
  const count = Math.max(match.bestOf || 1, games.length, 1);

  return Array.from({ length: count }, (_, index) => {
    const game = games[index];
    return {
      gameNumber: game?.gameNumber ?? index + 1,
      home: game?.homeScore ?? null,
      away: game?.awayScore ?? null,
    };
  });
};

/** A game is only marked won when both sides are filled in. */
export const isCellWinner = (value: number | null, other: number | null): boolean =>
  value !== null && other !== null && value > other;
