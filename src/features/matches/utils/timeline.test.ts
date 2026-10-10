import {
  groupMatchesBySlot,
  groupLiveMatches,
  defaultTab,
  defaultDate,
  doneRequestPages,
  courtLabels,
  courtShort,
  isLive,
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
  expect(defaultTab({ live: 0, next: 4, done: 9 })).toBe("next");
  expect(defaultTab({ live: 2, next: 4, done: 9 })).toBe("live");
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
  expect(TAB_STATUS).toEqual({ live: "in-progress", next: "upcoming", done: "completed" });
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

// Review M6: "Court 1" and "Beach Court 1" both read "C1".
test("court labels keep the full name only for courts whose short names clash", () => {
  const label = courtLabels(["Court 1", "Beach Court 1", "Court 2", "Centre Court", null]);
  expect(label("Court 1")).toBe("Court 1");
  expect(label("Beach Court 1")).toBe("Beach Court 1");
  expect(label("Court 2")).toBe("C2");
  expect(label("Centre Court")).toBe("Centre");
  expect(label(undefined)).toBe("—");
  // The same court twice isn't a clash.
  expect(courtLabels(["Court 1", "Court 1 "])("Court 1")).toBe("C1");
});
