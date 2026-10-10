import {
  groupMatchesBySlot,
  groupLiveMatches,
  defaultTab,
  defaultDate,
  doneRequestPages,
  courtName,
  courtShort,
  isLive,
  isTournamentOver,
  sortByStartTime,
  TAB_STATUS,
} from "./timeline";

const m = (id: string, startTime?: string, extra: object = {}) => ({ id, startTime, isCompleted: false, ...extra }) as any;

test("groups by start minute, no-time last", () => {
  const g = groupMatchesBySlot([m("b", "2026-10-12T15:20:00"), m("x"), m("a", "2026-10-12T15:00:00"), m("c", "2026-10-12T15:20:00")], { showDates: false, descending: false });
  expect(g.map((x) => x.label)).toEqual(["15:00", "15:20", "No time"]);
  expect(g[1].matches.map((x) => x.id)).toEqual(["b", "c"]);
});

test("date labels only when showDates, descending reverses", () => {
  const g = groupMatchesBySlot([m("a", "2026-10-11T09:00:00"), m("b", "2026-10-12T09:00:00")], { showDates: true, descending: true });
  expect(g.map((x) => x.matches[0].id)).toEqual(["b", "a"]);
  expect(g[0].dateLabel).toMatch(/12/);
});

test("defaults", () => {
  expect(defaultTab({ counts: { live: 0, next: 4, done: 9 } })).toBe("next");
  expect(defaultTab({ counts: { live: 2, next: 4, done: 9 } })).toBe("live");
  expect(defaultDate(["2026-10-11", "2026-10-12"], new Date(2026, 9, 12, 10))).toBe("2026-10-12");
  expect(defaultDate(["2026-10-11"], new Date(2026, 9, 12, 10))).toBe("all");
});

test("done pages newest first", () => {
  expect(doneRequestPages(65, 30)).toEqual([3, 2, 1]);
  expect(doneRequestPages(0, 30)).toEqual([]);
});

test("court short names", () => {
  expect(courtShort("Court 1")).toBe("C1");
  expect(courtShort(null)).toBe("—");
});

// ---- beyond the brief ----

test("a date header only on the first slot of each day, none without showDates", () => {
  const matches = [m("a", "2026-10-11T09:00:00"), m("b", "2026-10-11T10:00:00"), m("c", "2026-10-12T09:00:00"), m("x")];
  const withDates = groupMatchesBySlot(matches, { showDates: true, descending: false });
  expect(withDates.map((x) => [x.label, x.dateLabel])).toEqual([
    ["09:00", "Sun 11 Oct"],
    ["10:00", undefined],
    ["09:00", "Mon 12 Oct"],
    ["No time", undefined],
  ]);
  // Same minute on different days stays two slots.
  expect(new Set(withDates.map((x) => x.key)).size).toBe(4);
  expect(groupMatchesBySlot(matches, { showDates: false, descending: false }).every((x) => !x.dateLabel)).toBe(true);
});

test("descending keeps no-time last and gives the newest slot of a day its header", () => {
  const g = groupMatchesBySlot([m("a", "2026-10-11T09:00:00"), m("x"), m("b", "2026-10-11T18:30:00")], { showDates: true, descending: true });
  expect(g.map((x) => x.label)).toEqual(["18:30", "09:00", "No time"]);
  expect(g.map((x) => x.dateLabel)).toEqual(["Sun 11 Oct", undefined, undefined]);
});

test("a slot lists its courts in natural order", () => {
  const g = groupMatchesBySlot(
    [m("c10", "2026-10-12T15:00:00", { venue: "Court 10" }), m("c2", "2026-10-12T15:00:00", { venue: "Court 2" }), m("none", "2026-10-12T15:00:00")],
    { showDates: false, descending: true }
  );
  expect(g[0].matches.map((x) => x.id)).toEqual(["c2", "c10", "none"]);
});

test("time slots in a given time zone", () => {
  const g = groupMatchesBySlot([m("a", "2026-10-12T13:05:00Z")], { showDates: true, descending: false, timeZone: "Africa/Cairo" });
  expect(g[0].label).toBe("16:05");
  expect(g[0].key).toBe("2026-10-12T16:05");
});

test("defaultDate also matches full date-times, returning the entry as given", () => {
  expect(defaultDate(["2026-10-12T00:00:00", "2026-10-13T00:00:00"], new Date(2026, 9, 12, 23, 30))).toBe("2026-10-12T00:00:00");
  expect(defaultDate([], new Date(2026, 9, 12))).toBe("all");
});

test("done pages for exact and partial pages", () => {
  expect(doneRequestPages(30, 30)).toEqual([1]);
  expect(doneRequestPages(31, 30)).toEqual([2, 1]);
});

test("more court names", () => {
  expect(courtShort("Centre Court")).toBe("Centre");
  expect(courtShort("court 12")).toBe("C12");
  expect(courtShort("Padel Court 2")).toBe("C2");
  expect(courtShort("  ")).toBe("—");
  expect(courtShort(undefined)).toBe("—");
  expect(courtShort("Stadium")).toBe("Stadium");
});

test("live means started and not completed; tabs map to the API statuses", () => {
  expect(isLive(m("a", undefined, { startedAt: "2026-10-12T15:00:00" }))).toBe(true);
  expect(isLive(m("a", undefined, { startedAt: "2026-10-12T15:00:00", isCompleted: true }))).toBe(false);
  expect(isLive(m("a", "2026-10-12T15:00:00"))).toBe(false);
  expect(TAB_STATUS).toEqual({ all: "all", live: "in-progress", next: "upcoming", done: "completed" });
});

// Review M1: with every day shown, Live also lists matches from earlier days that were never closed.
test("Live: today's matches under Now, court by court; earlier days' under their day, newest first", () => {
  const now = new Date(2026, 9, 12, 16, 0);
  const g = groupLiveMatches(
    [
      m("c2", "2026-10-12T15:00:00", { venue: "Court 2" }),
      m("old", "2026-10-10T09:00:00", { venue: "Court 1" }),
      m("c1", "2026-10-12T15:40:00", { venue: "Court 1" }),
      m("older", "2026-10-11T18:30:00", { venue: "Court 3" }),
    ],
    { showDates: true, now }
  );
  expect(g.map((x) => [x.label, x.dateLabel, x.matches.map((match) => match.id)])).toEqual([
    ["Now", undefined, ["c1", "c2"]],
    ["18:30", "Sun 11 Oct", ["older"]],
    ["09:00", "Sat 10 Oct", ["old"]],
  ]);
});

test("Live: one Now group when a single day is shown, or when every match is today's", () => {
  const now = new Date(2026, 9, 12, 16, 0);
  const matches = [m("a", "2026-10-11T09:00:00", { venue: "Court 2" }), m("b", "2026-10-12T15:00:00", { venue: "Court 1" })];
  expect(groupLiveMatches(matches, { showDates: false, now }).map((x) => [x.label, x.matches.map((match) => match.id)])).toEqual([
    ["Now", ["b", "a"]],
  ]);
  expect(groupLiveMatches([matches[1]], { showDates: true, now }).map((x) => x.label)).toEqual(["Now"]);
  // Nothing from today: no "Now" header over an old match.
  expect(groupLiveMatches([matches[0]], { showDates: true, now }).map((x) => [x.label, x.dateLabel])).toEqual([["09:00", "Sun 11 Oct"]]);
});

// Task 10 (owner): rows show the court as stored ("Court 2", not "C2"); the Filters sheet's chips keep courtShort.
test("court names for the rows: the name as stored, a dash without one", () => {
  expect(courtName("Court 2")).toBe("Court 2");
  expect(courtName("  Centre Court ")).toBe("Centre Court");
  expect(courtName("Beach Court 1")).toBe("Beach Court 1");
  expect(courtName(null)).toBe("—");
  expect(courtName(undefined)).toBe("—");
  expect(courtName("   ")).toBe("—");
});

// Task 10 (owner): an All tab next to Live · Up next · Done.
test("All: the server's upcoming-then-played order comes out in time order, matches without a time last", () => {
  // Status "all" lists the matches without a start time first, then the upcoming ones, then the played ones.
  const serverOrder = [
    m("untimed"),
    m("next1", "2026-10-12T16:00:00"),
    m("next2", "2026-10-12T17:00:00"),
    m("played1", "2026-10-11T09:00:00", { isCompleted: true }),
    m("played2", "2026-10-12T10:00:00", { startedAt: "2026-10-12T10:02:00" }),
  ];
  const sorted = sortByStartTime(serverOrder);
  expect(sorted.map((x) => x.id)).toEqual(["played1", "played2", "next1", "next2", "untimed"]);
  // The input is left as it was.
  expect(serverOrder.map((x) => x.id)).toEqual(["untimed", "next1", "next2", "played1", "played2"]);

  // Grouped like Up next: time headers (a date header on each day's first slot when every day shows), "No time" last.
  const groups = groupMatchesBySlot(sorted, { showDates: true, descending: false });
  expect(groups.map((x) => [x.label, x.dateLabel, x.matches.map((match) => match.id)])).toEqual([
    ["09:00", "Sun 11 Oct", ["played1"]],
    ["10:00", "Mon 12 Oct", ["played2"]],
    ["16:00", undefined, ["next1"]],
    ["17:00", undefined, ["next2"]],
    ["No time", undefined, ["untimed"]],
  ]);
});

test("sorting by start time keeps the order of matches that start together, unreadable times count as none", () => {
  const sorted = sortByStartTime([m("b", "2026-10-12T15:00:00"), m("bad", "soon"), m("a", "2026-10-12T15:00:00"), m("x")]);
  expect(sorted.map((x) => x.id)).toEqual(["b", "a", "bad", "x"]);
});

// Task 10 (owner): "when a tournament is done, open the matches tab on the done filter instead of up next with no
// matches". All is never where a tournament opens.
test("the tab a tournament opens on: Done once it is over, else Live, Up next, Done in that order", () => {
  // The page passes all four counts (useMatchList's MatchCounts).
  const counts = (live: number, next: number, done: number) => ({ all: live + next + done, live, next, done });

  // Over, with finished matches: Done, even beside a match nobody closed (it would still count as live).
  expect(defaultTab({ counts: counts(1, 2, 26), tournamentOver: true })).toBe("done");
  expect(defaultTab({ counts: counts(0, 0, 26), tournamentOver: true })).toBe("done");
  // Over with nothing finished: the usual order.
  expect(defaultTab({ counts: counts(0, 3, 0), tournamentOver: true })).toBe("next");

  // During the event: Live while anything is live, then Up next, then Done (only finished matches left).
  expect(defaultTab({ counts: counts(2, 4, 26) })).toBe("live");
  expect(defaultTab({ counts: counts(2, 4, 26), tournamentOver: false })).toBe("live");
  expect(defaultTab({ counts: counts(0, 4, 26) })).toBe("next");
  expect(defaultTab({ counts: counts(0, 0, 26) })).toBe("done");

  // Nothing at all: Up next.
  expect(defaultTab({ counts: counts(0, 0, 0) })).toBe("next");
  expect(defaultTab({ counts: counts(0, 0, 0), tournamentOver: true })).toBe("next");
});

test("a tournament is over once its end date is before today (local days)", () => {
  const today = new Date(2026, 9, 12, 10, 0);
  expect(isTournamentOver("2026-10-11T00:00:00", today)).toBe(true);
  expect(isTournamentOver("2026-10-11", today)).toBe(true);
  expect(isTournamentOver("2026-09-30T00:00:00", today)).toBe(true);
  // Its last day isn't over yet.
  expect(isTournamentOver("2026-10-12T00:00:00", today)).toBe(false);
  expect(isTournamentOver("2026-10-12", new Date(2026, 9, 12, 23, 59))).toBe(false);
  expect(isTournamentOver("2026-10-13T00:00:00", today)).toBe(false);
  // Just after midnight, yesterday's tournament is over.
  expect(isTournamentOver("2026-10-11T00:00:00", new Date(2026, 9, 12, 0, 5))).toBe(true);
  // Unknown: not over.
  expect(isTournamentOver(undefined, today)).toBe(false);
  expect(isTournamentOver(null, today)).toBe(false);
  expect(isTournamentOver("", today)).toBe(false);
  expect(isTournamentOver("not a date", today)).toBe(false);
});
