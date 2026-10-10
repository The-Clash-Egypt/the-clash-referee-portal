import { formatOption, nameForValue, normalizeFilterOptions } from "./filterOptions";

test("courts in natural order, regular rounds before knockouts in tournament order", () => {
  const options = normalizeFilterOptions({
    venues: ["Court 10", "Court 2", "Court 1"],
    rounds: ["Final", "Round 10", "Quarter Final", "Round 2", "Round of 16", "Semi Final"],
  });
  expect(options.venues).toEqual(["Court 1", "Court 2", "Court 10"]);
  expect(options.rounds).toEqual(["Round 2", "Round 10", "Round of 16", "Quarter Final", "Semi Final", "Final"]);
  expect(options.dates).toEqual([]);
  expect(normalizeFilterOptions(undefined).teams).toEqual([]);
});

test("format and person options as strings or objects", () => {
  expect(formatOption("Knockout")).toEqual({ value: "Knockout", label: "Knockout" });
  expect(formatOption({ alias: "Cup", name: "Knockout" } as any)).toEqual({ value: "Cup", label: "Cup" });
  expect(formatOption({ name: "League" } as any)).toEqual({ value: "League", label: "League" });
  expect(nameForValue([{ id: "r1", fullName: "Mona Samir" }], "r1")).toBe("Mona Samir");
  expect(nameForValue(["Sand Sharks"], "Sand Sharks")).toBe("Sand Sharks");
  expect(nameForValue([], "r9")).toBe("r9");
});
