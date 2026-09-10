import { Match } from "../features/matches/types/match";

/** One game's box pair on the score grid. `null` means "blank, fill in by hand". */
export interface ScoreCell {
  gameNumber: number;
  home: number | null;
  away: number | null;
}

/** Cells typed into the preview but not yet saved, keyed by match id. */
export type ScoreDrafts = Record<string, ScoreCell[]>;

/**
 * Geometry of the handwriting boxes, in PDF points. The HTML sheet reads the same numbers
 * through sheetCssVariables (src/utils/matchSheetLayout.ts).
 */
export const SCORE_BOX_AREA_WIDTH = 170;
export const SCORE_CELL_MAX_WIDTH = 30;
export const SCORE_CELL_HEIGHT = 24;
export const SCORE_BOX_GAP = 4;

/**
 * Boxes stay full size up to five games (5 × 30 + 4 × 4 = 166pt) and shrink beyond that so a
 * long best-of never pushes into the QR column.
 */
export const scoreCellWidth = (cellCount: number): number => {
  const count = Math.max(cellCount, 1);
  return Math.min(SCORE_CELL_MAX_WIDTH, (SCORE_BOX_AREA_WIDTH - SCORE_BOX_GAP * (count - 1)) / count);
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
