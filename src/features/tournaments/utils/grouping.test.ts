import { tournamentGroup } from "./grouping";

test("Live · Upcoming · Past: completed tournaments are past, inactive ones are not shown", () => {
  expect(tournamentGroup("active")).toBe("active");
  expect(tournamentGroup("upcoming")).toBe("upcoming");
  expect(tournamentGroup("past")).toBe("past");
  expect(tournamentGroup("completed")).toBe("past");
  expect(tournamentGroup("inactive")).toBeUndefined();
  expect(tournamentGroup("draft")).toBeUndefined();
});
