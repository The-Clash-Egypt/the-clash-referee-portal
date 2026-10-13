import { filtersByPlayer, formatOption, nameForValue, normalizeFilterOptions, teamFilterCopy } from "./filterOptions";

test("courts in natural order, regular rounds before knockouts in tournament order", () => {
  const options = normalizeFilterOptions({
    venues: ["Court 10", "Court 2", "Court 1"],
    rounds: ["Final", "Round 10", "Quarter Final", "Round 2", "Round of 16", "Semi Final"],
  });
  expect(options.venues).toEqual(["Court 1", "Court 2", "Court 10"]);
  expect(options.rounds).toEqual(["Round 2", "Round 10", "Round of 16", "Quarter Final", "Semi Final", "Final"]);
  expect(options.dates).toEqual([]);
  expect(normalizeFilterOptions(undefined).teams).toEqual([]);
  expect(normalizeFilterOptions({ categories: ["Mixed Americano"] }).playerCategories).toEqual([]);
  expect(normalizeFilterOptions({ playerCategories: ["Mixed Americano"] }).playerCategories).toEqual(["Mixed Americano"]);
});

test("format and person options as strings or objects", () => {
  expect(formatOption("Knockout")).toEqual({ value: "Knockout", label: "Knockout" });
  expect(formatOption({ alias: "Cup", name: "Knockout" } as any)).toEqual({ value: "Cup", label: "Cup" });
  expect(formatOption({ name: "League" } as any)).toEqual({ value: "League", label: "League" });
  expect(nameForValue([{ id: "r1", fullName: "Mona Samir" }], "r1")).toBe("Mona Samir");
  expect(nameForValue(["Sand Sharks"], "Sand Sharks")).toBe("Sand Sharks");
  expect(nameForValue([], "r9")).toBe("r9");
});

describe("the Team filter becomes a Player filter", () => {
  const options = normalizeFilterOptions({
    categories: ["Mixed Americano", "Men's Mexicano", "Men's Open"],
    playerCategories: ["Mixed Americano", "Men's Mexicano"],
  });

  test("for a category whose units are single players", () => {
    expect(filtersByPlayer("Mixed Americano", options)).toBe(true);
    expect(filtersByPlayer("Men's Mexicano", options)).toBe(true);
    expect(filtersByPlayer("Men's Open", options)).toBe(false);
  });

  test("with no category filtered, only when every category on offer is of single players", () => {
    expect(filtersByPlayer("all", options)).toBe(false);
    expect(filtersByPlayer("all", { ...options, categories: ["Mixed Americano", "Men's Mexicano"] })).toBe(true);
    expect(filtersByPlayer("all", { ...options, categories: [] })).toBe(false);
  });

  test("never when the server sends no player categories (a server before them)", () => {
    const before = normalizeFilterOptions({ categories: ["Mixed Americano"] });
    expect(filtersByPlayer("Mixed Americano", before)).toBe(false);
    expect(filtersByPlayer("all", before)).toBe(false);
    expect(filtersByPlayer("Mixed Americano", { categories: ["Mixed Americano"] })).toBe(false);
  });

  test("the filter's words", () => {
    expect(teamFilterCopy(true)).toEqual({ label: "Player", allLabel: "All players" });
    expect(teamFilterCopy(false)).toEqual({ label: "Team", allLabel: "All Teams" });
  });
});
