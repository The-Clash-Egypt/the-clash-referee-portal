import { Match } from "../features/matches/types/match";
import {
  cellsFromGameScores,
  gameScoresFromCells,
  hasAnyScore,
  sameCells,
  validateGameScores,
} from "./scoreValidation";

const match = (over: Partial<Match> = {}): Match =>
  ({ id: "m", isCompleted: false, bestOf: 3, formatType: "Group", ...over }) as Match;

const cells = (...pairs: Array<[number | null, number | null]>) =>
  pairs.map(([home, away], index) => ({ gameNumber: index + 1, home, away }));

describe("validateGameScores", () => {
  it("accepts a normal best-of-3 result", () => {
    expect(validateGameScores(match(), cells([21, 17], [18, 21], [15, 11]))).toEqual([]);
  });

  it("does not treat an empty grid as an error — callers decide what empty means", () => {
    expect(validateGameScores(match(), cells([null, null], [null, null]))).toEqual([]);
  });

  it("flags a game with only one side filled in", () => {
    expect(validateGameScores(match(), cells([21, null]))).toEqual(["Game 1 needs both scores."]);
  });

  it("flags a blank game sitting before a scored one", () => {
    expect(validateGameScores(match(), cells([21, 17], [null, null], [15, 11]))).toEqual([
      "Game 2 is empty but a later game has a score.",
    ]);
  });

  it("rejects a tied game when the format gives no draw points", () => {
    expect(validateGameScores(match(), cells([21, 17], [20, 20]))).toEqual(["Game 2 cannot end in a tie."]);
  });

  it("allows a tied game when the category awards draw points", () => {
    expect(validateGameScores(match({ pointsForDraw: 1 }), cells([20, 20]))).toEqual([]);
  });

  it("accepts a 21-0 game", () => {
    expect(validateGameScores(match(), cells([21, 0]))).toEqual([]);
  });

  describe("Americano / Mexicano", () => {
    const fixed = (over: Partial<Match> = {}) => match({ formatType: "Americano", bestOf: 1, pointsPerMatch: 21, ...over });

    it("requires the points to add up to the match total", () => {
      expect(validateGameScores(fixed(), cells([12, 8]))).toEqual(["Total points must equal 21 (currently 20)."]);
    });

    it("allows a tie", () => {
      expect(validateGameScores(fixed({ formatType: "Mexicano", pointsPerMatch: 24 }), cells([12, 12]))).toEqual([]);
    });

    it("rejects more than one game", () => {
      expect(validateGameScores(fixed(), cells([11, 10], [12, 9]))).toContain(
        "This match is a single game — enter one score pair only."
      );
    });
  });
});

describe("conversions", () => {
  it("reads a 0-0 game as blank but keeps a 21-0 game", () => {
    expect(
      cellsFromGameScores([
        { gameNumber: 1, homeScore: 21, awayScore: 0 },
        { gameNumber: 2, homeScore: 0, awayScore: 0 },
      ])
    ).toEqual([
      { gameNumber: 1, home: 21, away: 0 },
      { gameNumber: 2, home: null, away: null },
    ]);
  });

  it("sends only complete pairs, keeping their game numbers", () => {
    expect(gameScoresFromCells(cells([21, 17], [null, null]))).toEqual([{ gameNumber: 1, homeScore: 21, awayScore: 17 }]);
  });

  it("knows when anything has been entered", () => {
    expect(hasAnyScore(cells([null, null]))).toBe(false);
    expect(hasAnyScore(cells([null, 3]))).toBe(true);
  });

  it("compares grids by value", () => {
    expect(sameCells(cells([21, 17]), cells([21, 17]))).toBe(true);
    expect(sameCells(cells([21, 17]), cells([21, 18]))).toBe(false);
    expect(sameCells(cells([21, 17]), cells([21, 17], [null, null]))).toBe(false);
  });
});
