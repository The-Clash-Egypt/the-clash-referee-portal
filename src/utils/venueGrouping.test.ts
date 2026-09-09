import { Match } from "../features/matches/types/match";
import {
  UNASSIGNED_VENUE_LABEL,
  compareVenueNames,
  groupMatchesByVenue,
  shouldGroupByVenue,
} from "./venueGrouping";

const match = (id: string, venue?: string, startTime?: string): Match =>
  ({ id, venue, startTime, isCompleted: false }) as Match;

describe("compareVenueNames", () => {
  it("orders court numbers naturally rather than lexically", () => {
    const sorted = ["Court 10", "Court 2", "Court 1"].sort(compareVenueNames);
    expect(sorted).toEqual(["Court 1", "Court 2", "Court 10"]);
  });
});

describe("groupMatchesByVenue", () => {
  it("groups matches by venue in natural venue order", () => {
    const groups = groupMatchesByVenue([
      match("a", "Court 10"),
      match("b", "Court 2"),
      match("c", "Court 10"),
    ]);

    expect(groups.map((g) => g.venue)).toEqual(["Court 2", "Court 10"]);
    expect(groups[1].matches.map((m) => m.id)).toEqual(["a", "c"]);
  });

  it("orders matches within a venue chronologically", () => {
    const groups = groupMatchesByVenue([
      match("late", "Court 1", "2026-07-12T14:00:00Z"),
      match("early", "Court 1", "2026-07-12T09:00:00Z"),
    ]);

    expect(groups[0].matches.map((m) => m.id)).toEqual(["early", "late"]);
  });

  it("puts matches without a start time last within their venue", () => {
    const groups = groupMatchesByVenue([
      match("unscheduled", "Court 1"),
      match("scheduled", "Court 1", "2026-07-12T09:00:00Z"),
    ]);

    expect(groups[0].matches.map((m) => m.id)).toEqual(["scheduled", "unscheduled"]);
  });

  it("collects matches with no venue into a single trailing group", () => {
    const groups = groupMatchesByVenue([
      match("none", undefined),
      match("blank", "   "),
      match("court", "Court 1"),
    ]);

    expect(groups.map((g) => g.venue)).toEqual(["Court 1", UNASSIGNED_VENUE_LABEL]);
    expect(groups[1].matches).toHaveLength(2);
  });

  it("returns no groups for an empty match list", () => {
    expect(groupMatchesByVenue([])).toEqual([]);
  });
});

describe("shouldGroupByVenue", () => {
  it("groups venue and general reports only", () => {
    expect(shouldGroupByVenue("venue")).toBe(true);
    expect(shouldGroupByVenue("general")).toBe(true);
    expect(shouldGroupByVenue("referee")).toBe(false);
    expect(shouldGroupByVenue("team")).toBe(false);
  });
});
