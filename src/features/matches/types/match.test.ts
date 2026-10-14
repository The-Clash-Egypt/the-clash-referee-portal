import { Match, isFixedPointsFormat, matchSideName, matchSideUnits, sideDisplayName } from "./match";

const match = (over: Partial<Match> = {}): Match => ({
  id: "m1",
  homeTeamName: "Ali",
  homeTeam2Name: "Bea",
  awayTeamName: "Cy",
  awayTeam2Name: "Dee",
  isCompleted: false,
  ...over,
});

describe("sideDisplayName", () => {
  it("joins a side's units: commas, then & before the last", () => {
    expect(sideDisplayName("A")).toBe("A");
    expect(sideDisplayName("A", "B")).toBe("A & B");
    expect(sideDisplayName("A", "B", ["C"])).toBe("A, B & C");
    expect(sideDisplayName("A", "B", ["C", "D"])).toBe("A, B, C & D");
  });

  it("says TBD for a side with no unit yet, and leaves out missing names", () => {
    expect(sideDisplayName(undefined)).toBe("TBD");
    expect(sideDisplayName(null, null, [])).toBe("TBD");
    expect(sideDisplayName("A", null, [])).toBe("A");
    expect(sideDisplayName("A", "", ["C"])).toBe("A & C");
  });

  it("shows the hidden individual-registration team as Individual", () => {
    expect(sideDisplayName("__INDIVIDUAL_REGISTRATION__")).toBe("Individual");
    expect(sideDisplayName("A", "B", ["__INDIVIDUAL_REGISTRATION__"])).toBe("A, B & Individual");
  });
});

describe("a match's sides", () => {
  it("include the units after the first two (Roulette), in slot order", () => {
    const roulette = match({
      formatType: "Roulette",
      homeExtraUnits: [
        { teamId: "t3", teamName: "Eve" },
        { teamId: "t4", teamName: "Fay" },
      ],
      awayExtraUnits: [{ teamId: "t7", teamName: "Gus" }],
    });

    expect(matchSideUnits(roulette, "home")).toEqual(["Ali", "Bea", "Eve", "Fay"]);
    expect(matchSideName(roulette, "home")).toBe("Ali, Bea, Eve & Fay");
    expect(matchSideName(roulette, "away")).toBe("Cy, Dee & Gus");
  });

  it("are the two units as before when the server sends no extras (older servers)", () => {
    expect(matchSideUnits(match(), "away")).toEqual(["Cy", "Dee"]);
    expect(matchSideName(match(), "home")).toBe("Ali & Bea");
    expect(matchSideName(match({ homeTeam2Name: null }), "home")).toBe("Ali");
    expect(matchSideName(match({ awayTeamName: undefined, awayTeam2Name: undefined }), "away")).toBe("TBD");
    expect(matchSideUnits(match({ awayTeamName: undefined, awayTeam2Name: undefined }), "away")).toEqual([]);
  });
});

it("counts Roulette as a fixed-points format, like Americano and Mexicano", () => {
  expect(isFixedPointsFormat("Roulette")).toBe(true);
  expect(isFixedPointsFormat("Americano")).toBe(true);
  expect(isFixedPointsFormat("Mexicano")).toBe(true);
  expect(isFixedPointsFormat("Knockout")).toBe(false);
  expect(isFixedPointsFormat(undefined)).toBe(false);
});
