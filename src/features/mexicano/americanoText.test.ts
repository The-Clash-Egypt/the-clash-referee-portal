import {
  americanoEnded,
  americanoStatus,
  canFinishEarly,
  finishConfirmText,
  finishedText,
  finishPlan,
  hasScore,
  roundNumber,
} from "./americanoText";
import { AmericanoMatch } from "./types";

let nextId = 0;
/** A match of `round`: "done" is complete, "live" has points in but isn't complete, "open" has no score. */
const match = (round: number | null, state: "done" | "live" | "open"): AmericanoMatch => ({
  id: `x${++nextId}`,
  round: round === null ? null : `Round ${round}`,
  isCompleted: state === "done",
  gameScores: state === "open" ? [] : [{ gameNumber: 1, homeScore: 9, awayScore: state === "done" ? 7 : 3 }],
});

/** Rounds 1-2 complete, round 3 half played (one done, one live, two open), rounds 4-5 not started: 4 courts. */
const halfway = [
  ...[1, 2].flatMap((r) => [match(r, "done"), match(r, "done"), match(r, "done"), match(r, "done")]),
  match(3, "done"),
  match(3, "live"),
  match(3, "open"),
  match(3, "open"),
  ...[4, 5].flatMap((r) => [match(r, "open"), match(r, "open"), match(r, "open"), match(r, "open")]),
];

describe("roundNumber", () => {
  it("reads the number out of the round's name", () => {
    expect(roundNumber("Round 12")).toBe(12);
    expect(roundNumber(null)).toBeNull();
    expect(roundNumber("Final")).toBeNull();
  });
});

describe("hasScore", () => {
  it("counts a complete match and one with live points, not one without a score", () => {
    expect(hasScore(match(1, "done"))).toBe(true);
    expect(hasScore(match(1, "live"))).toBe(true);
    expect(hasScore(match(1, "open"))).toBe(false);
    expect(hasScore({ id: "x", isCompleted: false, gameScores: null })).toBe(false);
  });
});

describe("americanoEnded", () => {
  it("takes the server's word, or sees every match complete", () => {
    expect(americanoEnded(halfway, true)).toBe(true);
    expect(americanoEnded(halfway, false)).toBe(false);
    expect(americanoEnded([match(1, "done"), match(2, "done")], null)).toBe(true);
    expect(americanoEnded([], null)).toBe(false);
    // A match without a round means a round is missing.
    expect(americanoEnded([match(1, "done"), match(null, "done")], null)).toBe(false);
  });
});

describe("americanoStatus", () => {
  it("names the lowest round with a match still to finish, out of the rounds drawn, and how much of it is in", () => {
    expect(americanoStatus(halfway, false)).toBe("Round 3 of 5 · 1/4 scored");
    expect(americanoStatus([match(1, "open"), match(1, "open"), match(2, "open")], null)).toBe(
      "Round 1 of 2 · 0/2 scored"
    );
  });

  it("orders rounds by number, not by name", () => {
    const rounds = Array.from({ length: 10 }, (_, i) => match(i + 1, i < 9 ? "done" : "open"));
    expect(americanoStatus(rounds, false)).toBe("Round 10 of 10 · 0/1 scored");
  });

  it("says Finished once the stage is over, and No schedule yet before it has matches", () => {
    expect(americanoStatus(halfway, true)).toBe("Finished");
    expect(americanoStatus([match(1, "done"), match(2, "done")], null)).toBe("Finished");
    expect(americanoStatus([], false)).toBe("No schedule yet");
  });
});

describe("canFinishEarly", () => {
  it("needs a score in and the stage not over", () => {
    expect(canFinishEarly(halfway, false)).toBe(true);
    expect(canFinishEarly([match(1, "live"), match(1, "open")], null)).toBe(true);
    expect(canFinishEarly([match(1, "open"), match(2, "open")], false)).toBe(false);
    expect(canFinishEarly(halfway, true)).toBe(false);
    expect(canFinishEarly([match(1, "done")], null)).toBe(false);
    expect(canFinishEarly([], null)).toBe(false);
  });
});

describe("finishPlan", () => {
  it("keeps every round with a score in and removes every match without one", () => {
    expect(finishPlan(halfway)).toEqual({ rounds: 3, unplayed: 10 });
    expect(finishPlan([match(1, "done"), match(2, "open")])).toEqual({ rounds: 1, unplayed: 1 });
  });
});

describe("finish texts", () => {
  it("asks before finishing, in the plural", () => {
    expect(finishConfirmText({ rounds: 3, unplayed: 10 })).toBe(
      "Finish after 3 rounds? 10 unplayed matches will be removed and the leaderboard becomes final. This can't be undone."
    );
  });

  it("asks before finishing, in the singular", () => {
    expect(finishConfirmText({ rounds: 1, unplayed: 1 })).toBe(
      "Finish after 1 round? 1 unplayed match will be removed and the leaderboard becomes final. This can't be undone."
    );
  });

  it("says what finishing did", () => {
    expect(finishedText({ roundsPlayed: 3, matchesRemoved: 10 })).toBe(
      "Finished after 3 rounds — 10 unplayed matches removed."
    );
    expect(finishedText({ roundsPlayed: 1, matchesRemoved: 1 })).toBe("Finished after 1 round — 1 unplayed match removed.");
  });
});
