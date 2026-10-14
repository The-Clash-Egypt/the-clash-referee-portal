import { repeatNote, roundLabel } from "./sessionText";
import { MexicanoSession } from "./types";

const session = (over: Partial<MexicanoSession> = {}) =>
  ({ blockType: "Roulette", plannedRounds: 0, currentRound: 0, ...over } as MexicanoSession);

describe("roundLabel", () => {
  it("counts planned rounds: Round N of M", () => {
    expect(roundLabel(session({ plannedRounds: 8 }))).toBe("8 rounds planned");
    expect(roundLabel(session({ plannedRounds: 8, currentRound: 3 }))).toBe("Round 3 of 8");
  });

  it("an open-ended stage (no planned rounds) says Round N, with no 'of'", () => {
    expect(roundLabel(session())).toBe("Open-ended");
    expect(roundLabel(session({ currentRound: 3 }))).toBe("Round 3");
  });
});

describe("repeatNote", () => {
  it("counts the line-ups of this round that were played before", () => {
    expect(repeatNote(session({ currentRoundRepeats: { lineUps: 2, matches: 1 } }))).toBe(
      "No fresh line-ups left for everyone here — 2 line-ups in this round were played before."
    );
    expect(repeatNote(session({ currentRoundRepeats: { lineUps: 1, matches: 0 } }))).toBe(
      "No fresh line-ups left for everyone here — 1 line-up in this round was played before."
    );
  });

  it("counts repeated matches when no line-up repeats (one unit a side)", () => {
    expect(repeatNote(session({ currentRoundRepeats: { lineUps: 0, matches: 1 } }))).toBe(
      "No fresh line-ups left for everyone here — 1 match in this round was played before."
    );
    expect(repeatNote(session({ currentRoundRepeats: { lineUps: 0, matches: 3 } }))).toBe(
      "No fresh line-ups left for everyone here — 3 matches in this round were played before."
    );
  });

  it("says nothing without repeats, or when the server doesn't send them", () => {
    expect(repeatNote(session({ currentRoundRepeats: { lineUps: 0, matches: 0 } }))).toBeNull();
    expect(repeatNote(session())).toBeNull();
  });
});
