import { Match } from "../features/matches/types/match";
import {
  SCORE_BOX_AREA_WIDTH,
  SCORE_BOX_GAP,
  SCORE_CELL_MAX_WIDTH,
  isCellWinner,
  scoreCellWidth,
  scoreCellsFor,
} from "./matchScoreCells";

const match = (over: Partial<Match> = {}): Match =>
  ({ id: "m", isCompleted: false, ...over }) as Match;

describe("scoreCellsFor", () => {
  it("gives one blank box per game of an unplayed best-of-N", () => {
    expect(scoreCellsFor(match({ bestOf: 5 }))).toEqual([
      { gameNumber: 1, home: null, away: null },
      { gameNumber: 2, home: null, away: null },
      { gameNumber: 3, home: null, away: null },
      { gameNumber: 4, home: null, away: null },
      { gameNumber: 5, home: null, away: null },
    ]);
  });

  it("defaults to a single box when bestOf is missing or zero", () => {
    expect(scoreCellsFor(match())).toHaveLength(1);
    expect(scoreCellsFor(match({ bestOf: 0 }))).toHaveLength(1);
  });

  it("uses the recorded game scores when the match is done", () => {
    const cells = scoreCellsFor(
      match({
        bestOf: 5,
        isCompleted: true,
        gameScores: [
          { gameNumber: 1, homeScore: 25, awayScore: 21 },
          { gameNumber: 2, homeScore: 19, awayScore: 25 },
        ],
      })
    );
    expect(cells).toEqual([
      { gameNumber: 1, home: 25, away: 21 },
      { gameNumber: 2, home: 19, away: 25 },
    ]);
  });

  it("seeds recorded scores into a full best-of grid while the match is live", () => {
    const cells = scoreCellsFor(
      match({
        bestOf: 5,
        gameScores: [{ gameNumber: 1, homeScore: 25, awayScore: 21 }],
      })
    );
    expect(cells).toHaveLength(5);
    expect(cells[0]).toEqual({ gameNumber: 1, home: 25, away: 21 });
  });

  it("falls back to the aggregate score for a completed match with no games", () => {
    expect(scoreCellsFor(match({ isCompleted: true, homeScore: 2, awayScore: 1 }))).toEqual([
      { gameNumber: 1, home: 2, away: 1 },
    ]);
  });

  it("leaves an unplayed match blank even when it has an aggregate score", () => {
    expect(scoreCellsFor(match({ bestOf: 3, homeScore: 0, awayScore: 0 }))).toEqual([
      { gameNumber: 1, home: null, away: null },
      { gameNumber: 2, home: null, away: null },
      { gameNumber: 3, home: null, away: null },
    ]);
  });
});

describe("scoreCellWidth", () => {
  it("keeps full-size writing boxes up to five games", () => {
    expect(scoreCellWidth(1)).toBe(SCORE_CELL_MAX_WIDTH);
    expect(scoreCellWidth(5)).toBe(SCORE_CELL_MAX_WIDTH);
  });

  it("shrinks boxes rather than overflowing from six games", () => {
    expect(scoreCellWidth(6)).toBeLessThan(SCORE_CELL_MAX_WIDTH);
  });

  it("never lets boxes and gaps exceed the box area", () => {
    for (let count = 1; count <= 12; count += 1) {
      const used = count * scoreCellWidth(count) + SCORE_BOX_GAP * (count - 1);
      expect(used).toBeLessThanOrEqual(SCORE_BOX_AREA_WIDTH + 1e-9);
    }
  });
});

describe("isCellWinner", () => {
  it("marks a winner only when both sides are filled in", () => {
    expect(isCellWinner(25, 21)).toBe(true);
    expect(isCellWinner(21, 25)).toBe(false);
    expect(isCellWinner(25, 25)).toBe(false);
    expect(isCellWinner(25, null)).toBe(false);
    expect(isCellWinner(null, null)).toBe(false);
  });
});

describe("scoreCellsFor with in-progress matches", () => {
  it("keeps a box per game of the best-of when only some games are recorded", () => {
    const cells = scoreCellsFor(
      match({
        bestOf: 5,
        gameScores: [
          { gameNumber: 1, homeScore: 25, awayScore: 21 },
          { gameNumber: 2, homeScore: 19, awayScore: 25 },
        ],
      })
    );

    expect(cells).toHaveLength(5);
    expect(cells[0]).toEqual({ gameNumber: 1, home: 25, away: 21 });
    expect(cells[4]).toEqual({ gameNumber: 5, home: null, away: null });
  });

  it("shows exactly the games played once the match is completed", () => {
    const cells = scoreCellsFor(
      match({
        bestOf: 5,
        isCompleted: true,
        gameScores: [
          { gameNumber: 1, homeScore: 25, awayScore: 21 },
          { gameNumber: 2, homeScore: 25, awayScore: 19 },
          { gameNumber: 3, homeScore: 25, awayScore: 22 },
        ],
      })
    );

    expect(cells).toHaveLength(3);
  });

  it("never renders fewer boxes than the recorded games", () => {
    const cells = scoreCellsFor(
      match({
        bestOf: 1,
        gameScores: [
          { gameNumber: 1, homeScore: 25, awayScore: 21 },
          { gameNumber: 2, homeScore: 19, awayScore: 25 },
        ],
      })
    );
    expect(cells).toHaveLength(2);
  });
});

describe("scoreCellsFor with a draft", () => {
  const draft = [
    { gameNumber: 1, home: 21, away: 18 },
    { gameNumber: 2, home: null, away: null },
    { gameNumber: 3, home: null, away: null },
  ];

  it("uses the draft verbatim, keeping the blank boxes", () => {
    expect(scoreCellsFor(match({ bestOf: 3 }), draft)).toEqual(draft);
  });

  it("lets a cleared cell stay blank instead of reverting to the recorded score", () => {
    const cells = scoreCellsFor(
      match({ gameScores: [{ gameNumber: 1, homeScore: 25, awayScore: 21 }] }),
      [{ gameNumber: 1, home: 25, away: null }]
    );
    expect(cells).toEqual([{ gameNumber: 1, home: 25, away: null }]);
  });

  it("ignores an empty draft", () => {
    expect(scoreCellsFor(match({ bestOf: 2 }), [])).toHaveLength(2);
  });
});
