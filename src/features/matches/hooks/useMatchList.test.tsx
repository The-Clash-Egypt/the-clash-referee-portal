import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getRefereeMatches } from "../api/matches";
import { MatchFilters } from "../types/match";
import { MatchFilterState } from "./useMatchFilters";
import { useMatchList } from "./useMatchList";

jest.mock("../api/matches", () => ({ getRefereeMatches: jest.fn() }));

const api = getRefereeMatches as jest.Mock;

const base: MatchFilterState = {
  tab: "live",
  search: "",
  date: "all",
  category: "all",
  format: "all",
  round: "all",
  venues: [],
  team: "all",
  referee: "all",
};

const match = (n: number, extra: object = {}) => ({
  id: `m${n}`,
  homeTeamName: `Home ${n}`,
  awayTeamName: `Away ${n}`,
  startTime: `2026-10-12T${String(8 + Math.floor(n / 6)).padStart(2, "0")}:${String((n % 6) * 10).padStart(2, "0")}:00`,
  isCompleted: false,
  ...extra,
});

/** A response like the server's: one page of `all` (1-based ids in server order) plus the counts. */
const page = (all: object[], pageNumber: number, pageSize: number, counts = { live: 0, next: 0, done: 0 }, total = all.length) => ({
  data: {
    success: true,
    data: {
      matches: {
        items: all.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
        pagination: { total, pageNumber, pageSize, totalPages: Math.ceil(total / pageSize) },
      },
      inProgressCount: counts.live,
      incomingCount: counts.next,
      completedCount: counts.done,
      filters: { tournaments: [], categories: ["Men's Open"], formats: [], rounds: ["Final", "Round 1"], venues: ["Court 10", "Court 2"], teams: [], referees: [], dates: ["2026-10-12"] },
    },
  },
});

const callsWith = (status: string) => api.mock.calls.map(([f]) => f as MatchFilters).filter((f) => f.status === status);

const wrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

beforeEach(() => {
  api.mockReset();
});

test("counts come from one status=all call that tab switches reuse", async () => {
  const live = [match(1, { startedAt: "x" }), match(2)];
  const next = [match(3), match(4), match(5)];
  api.mockImplementation((f: MatchFilters) => {
    const counts = { live: 2, next: 3, done: 0 };
    if (f.status === "in-progress") return Promise.resolve(page(live, f.pageNumber!, f.pageSize!, counts));
    if (f.status === "upcoming") return Promise.resolve(page(next, f.pageNumber!, f.pageSize!, counts));
    return Promise.resolve(page([...live, ...next], f.pageNumber!, f.pageSize!, counts));
  });

  const { result, rerender } = renderHook(({ filters }) => useMatchList("t1", filters), {
    wrapper: wrapper(),
    initialProps: { filters: base },
  });

  await waitFor(() => expect(result.current.matches.map((m) => m.id)).toEqual(["m1", "m2"]));
  expect(callsWith("all")).toEqual([expect.objectContaining({ status: "all", pageSize: 1, pageNumber: 1, tournament: "t1" })]);
  expect(callsWith("in-progress")).toEqual([expect.objectContaining({ pageSize: 30, pageNumber: 1, tournament: "t1" })]);
  expect(result.current.counts).toEqual({ all: 5, live: 2, next: 3, done: 0 });
  // Courts in natural order, knockout rounds after the others.
  expect(result.current.filterOptions.venues).toEqual(["Court 2", "Court 10"]);
  expect(result.current.filterOptions.rounds).toEqual(["Round 1", "Final"]);

  rerender({ filters: { ...base, tab: "next" } });

  await waitFor(() => expect(result.current.matches.map((m) => m.id)).toEqual(["m3", "m4", "m5"]));
  expect(callsWith("upcoming")).toHaveLength(1);
  expect(callsWith("all")).toHaveLength(1);
});

test("Done starts from the last page and lists the newest first", async () => {
  const done = Array.from({ length: 65 }, (_, i) => match(i + 1, { isCompleted: true }));
  api.mockImplementation((f: MatchFilters) => {
    const counts = { live: 0, next: 0, done: 65 };
    if (f.status === "completed") return Promise.resolve(page(done, f.pageNumber!, f.pageSize!, counts));
    return Promise.resolve(page(done, f.pageNumber!, f.pageSize!, counts));
  });

  const { result } = renderHook(() => useMatchList("t1", { ...base, tab: "done" }), { wrapper: wrapper() });

  // The last page has only 5: the page before it comes along, so Done opens with 35.
  await waitFor(() => expect(result.current.matches).toHaveLength(35));
  expect(callsWith("completed").map((f) => [f.pageNumber, f.pageSize])).toEqual([
    [3, 30],
    [2, 30],
  ]);
  expect(result.current.matches.slice(0, 6).map((m) => m.id)).toEqual(["m65", "m64", "m63", "m62", "m61", "m60"]);
  expect(result.current.matches[34].id).toBe("m31");
  expect(result.current.hasMore).toBe(true);

  act(() => result.current.loadMore());

  await waitFor(() => expect(result.current.matches).toHaveLength(65));
  expect(callsWith("completed")[2]).toEqual(expect.objectContaining({ pageNumber: 1 }));
  expect(result.current.matches[35].id).toBe("m30");
  expect(result.current.matches[64].id).toBe("m1");
  expect(result.current.hasMore).toBe(false);
});

// Review I3: 31 or 61 completed matches used to open Done on a single match.
test("Done opens with a full first view when the last page is short: 61 done shows 31, newest first", async () => {
  const done = Array.from({ length: 61 }, (_, i) => match(i + 1, { isCompleted: true }));
  api.mockImplementation((f: MatchFilters) => Promise.resolve(page(done, f.pageNumber!, f.pageSize!, { live: 0, next: 0, done: 61 })));

  const { result } = renderHook(() => useMatchList("t1", { ...base, tab: "done" }), { wrapper: wrapper() });

  await waitFor(() => expect(result.current.matches).toHaveLength(31));
  expect(result.current.matches[0].id).toBe("m61");
  expect(result.current.matches[1].id).toBe("m60");
  expect(result.current.matches[30].id).toBe("m31");
  expect(callsWith("completed").map((f) => f.pageNumber)).toEqual([3, 2]);
  expect(result.current.hasMore).toBe(true);
});

// Review M7: the first page param is stored at the first load; refreshes used to ask for that stale page first.
test("a Done refresh starts from the last page as the latest counts have it", async () => {
  let doneCount = 30;
  api.mockImplementation((f: MatchFilters) => {
    const done = Array.from({ length: doneCount }, (_, i) => match(i + 1, { isCompleted: true }));
    return Promise.resolve(page(done, f.pageNumber!, f.pageSize!, { live: 0, next: 0, done: doneCount }));
  });

  const { result } = renderHook(() => useMatchList("t1", { ...base, tab: "done" }), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.matches).toHaveLength(30));
  expect(callsWith("completed").map((f) => f.pageNumber)).toEqual([1]);

  // One more finishes. The refresh that learns it still starts from the old last page, then corrects itself…
  doneCount = 31;
  act(() => result.current.refetch());
  await waitFor(() => expect(result.current.matches).toHaveLength(31));
  expect(callsWith("completed").map((f) => f.pageNumber)).toEqual([1, 1, 2, 1]);

  // …and the next one asks for the new last page straight away (the stored first page would still say 1).
  act(() => result.current.refetch());
  await waitFor(() => expect(callsWith("completed")).toHaveLength(6));
  expect(callsWith("completed").map((f) => f.pageNumber).slice(4)).toEqual([2, 1]);
  expect(result.current.matches[0].id).toBe("m31");
});

test("Done doesn't fetch a page before a full last page", async () => {
  const done = Array.from({ length: 60 }, (_, i) => match(i + 1, { isCompleted: true }));
  api.mockImplementation((f: MatchFilters) => Promise.resolve(page(done, f.pageNumber!, f.pageSize!, { live: 0, next: 0, done: 60 })));

  const { result } = renderHook(() => useMatchList("t1", { ...base, tab: "done" }), { wrapper: wrapper() });

  await waitFor(() => expect(result.current.matches).toHaveLength(30));
  expect(result.current.matches[0].id).toBe("m60");
  expect(callsWith("completed").map((f) => f.pageNumber)).toEqual([2]);
});

test("Done jumps to the real last page when the search leaves fewer pages than the counts", async () => {
  // The server's counts ignore the search; the list's own total doesn't.
  const found = [match(7, { isCompleted: true }), match(9, { isCompleted: true })];
  api.mockImplementation((f: MatchFilters) => {
    const counts = { live: 0, next: 0, done: 65 };
    if (f.status === "completed") return Promise.resolve(page(found, f.pageNumber!, f.pageSize!, counts));
    return Promise.resolve(page([], 1, 1, counts, 65));
  });

  const { result } = renderHook(() => useMatchList("t1", { ...base, tab: "done", search: "sharks" }), { wrapper: wrapper() });

  await waitFor(() => expect(result.current.matches.map((m) => m.id)).toEqual(["m9", "m7"]));
  expect(callsWith("completed").map((f) => f.pageNumber)).toEqual([3, 1]);
  expect(callsWith("completed")[0]).toEqual(expect.objectContaining({ search: "sharks" }));
  expect(result.current.hasMore).toBe(false);

  // Review M7: a refresh starts from the page the list last reported, not the counts' guess again.
  act(() => result.current.refetch());
  await waitFor(() => expect(callsWith("completed")).toHaveLength(3));
  expect(callsWith("completed").map((f) => f.pageNumber)).toEqual([3, 1, 1]);
  expect(result.current.matches.map((m) => m.id)).toEqual(["m9", "m7"]);
});

test("nothing done: no list request, not loading", async () => {
  api.mockImplementation((f: MatchFilters) => Promise.resolve(page([], 1, f.pageSize!, { live: 1, next: 0, done: 0 }, 1)));

  const { result } = renderHook(() => useMatchList("t1", { ...base, tab: "done" }), { wrapper: wrapper() });

  await waitFor(() => expect(result.current.counts.live).toBe(1));
  expect(result.current.isLoading).toBe(false);
  expect(result.current.matches).toEqual([]);
  expect(callsWith("completed")).toHaveLength(0);
});

test("Up next ends with the matches that have no start time yet", async () => {
  const upcoming = [match(1), match(2)];
  const unscheduled = { ...match(3), startTime: undefined };
  const finishedUntimed = { ...match(4, { isCompleted: true }), startTime: undefined };
  api.mockImplementation((f: MatchFilters) => {
    // 2 upcoming + 1 unscheduled + 1 done (also without a time): the "all" total is one more than the tab counts.
    const counts = { live: 0, next: 2, done: 1 };
    if (f.status === "upcoming") return Promise.resolve(page(upcoming, f.pageNumber!, f.pageSize!, counts));
    // The server lists matches without a start time first.
    return Promise.resolve(page([unscheduled, finishedUntimed, ...upcoming], f.pageNumber!, f.pageSize!, counts, 4));
  });

  const { result } = renderHook(() => useMatchList("t1", { ...base, tab: "next" }), { wrapper: wrapper() });

  await waitFor(() => expect(result.current.matches.map((m) => m.id)).toEqual(["m1", "m2", "m3"]));
  expect(result.current.counts).toEqual({ all: 4, live: 0, next: 3, done: 1 });
  expect(callsWith("all").map((f) => f.pageSize)).toEqual([1, 30]);
});

test("waits while not enabled", async () => {
  api.mockImplementation((f: MatchFilters) => Promise.resolve(page([match(1)], 1, f.pageSize!, { live: 1, next: 0, done: 0 })));

  const { result } = renderHook(() => useMatchList("t1", base, { enabled: false }), { wrapper: wrapper() });

  await waitFor(() => expect(result.current.counts.live).toBe(1));
  expect(callsWith("in-progress")).toHaveLength(0);
  expect(result.current.isLoading).toBe(true);
});

// Review I1: a refresh that fails (weak signal courtside, back from WhatsApp) must not blank a list that loaded.
test("a failed refresh keeps the matches on screen and says so; it isn't the full-page error", async () => {
  let offline = false;
  api.mockImplementation((f: MatchFilters) =>
    offline ? Promise.reject(new Error("offline")) : Promise.resolve(page([match(1)], 1, f.pageSize!, { live: 1, next: 0, done: 0 }))
  );

  const { result } = renderHook(() => useMatchList("t1", base), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.matches.map((m) => m.id)).toEqual(["m1"]));
  expect(result.current.refreshFailed).toBe(false);

  offline = true;
  act(() => result.current.refetch());

  await waitFor(() => expect(result.current.refreshFailed).toBe(true));
  expect(result.current.isError).toBe(false);
  expect(result.current.matches.map((m) => m.id)).toEqual(["m1"]);
  expect(result.current.counts.live).toBe(1);

  offline = false;
  act(() => result.current.refetch());
  await waitFor(() => expect(result.current.refreshFailed).toBe(false));
});

test("Done keeps its matches when only the counts' refresh fails", async () => {
  let countsOffline = false;
  const done = [match(1, { isCompleted: true }), match(2, { isCompleted: true })];
  api.mockImplementation((f: MatchFilters) =>
    f.status === "all" && countsOffline
      ? Promise.reject(new Error("offline"))
      : Promise.resolve(page(done, f.pageNumber!, f.pageSize!, { live: 0, next: 0, done: 2 }))
  );

  const { result } = renderHook(() => useMatchList("t1", { ...base, tab: "done" }), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.matches).toHaveLength(2));

  countsOffline = true;
  act(() => result.current.refetch());

  await waitFor(() => expect(result.current.refreshFailed).toBe(true));
  expect(result.current.isError).toBe(false);
  expect(result.current.isLoading).toBe(false);
  expect(result.current.matches.map((m) => m.id)).toEqual(["m2", "m1"]);
});

test("a list that never loaded is the full-page error", async () => {
  api.mockImplementation((f: MatchFilters) =>
    f.status === "in-progress" ? Promise.reject(new Error("offline")) : Promise.resolve(page([match(1)], 1, f.pageSize!, { live: 1, next: 0, done: 0 }))
  );

  const { result } = renderHook(() => useMatchList("t1", base), { wrapper: wrapper() });

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.refreshFailed).toBe(false);
  expect(result.current.matches).toEqual([]);
});

test("a failed counts call is an error (nothing to work the defaults out from)", async () => {
  api.mockImplementation((f: MatchFilters) =>
    f.status === "all" ? Promise.reject(new Error("offline")) : Promise.resolve(page([match(1)], 1, f.pageSize!))
  );

  const { result } = renderHook(() => useMatchList("t1", base, { enabled: false }), { wrapper: wrapper() });

  await waitFor(() => expect(result.current.isError).toBe(true));
});

// ---- Task 10 (owner): the All tab ----

test("All asks for every status 100 at a time and lists the matches in time order; its count is the counts call's total", async () => {
  const played = match(1, { isCompleted: true, gameScores: [{ gameNumber: 1, homeScore: 21, awayScore: 15 }] });
  const live = match(2, { startedAt: "x" });
  const upcoming = [match(30), match(31)];
  const untimed = { ...match(40), startTime: undefined };
  api.mockImplementation((f: MatchFilters) => {
    const counts = { live: 1, next: 2, done: 1 };
    if (f.status === "in-progress") return Promise.resolve(page([live], f.pageNumber!, f.pageSize!, counts));
    // Like the server: no start time first, then upcoming, then played, each by start time.
    return Promise.resolve(page([untimed, ...upcoming, played, live], f.pageNumber!, f.pageSize!, counts));
  });

  const { result, rerender } = renderHook(({ filters }) => useMatchList("t1", filters), {
    wrapper: wrapper(),
    initialProps: { filters: base },
  });
  await waitFor(() => expect(result.current.matches.map((m) => m.id)).toEqual(["m2"]));
  // 5 in all: 1 live, 2 upcoming + 1 without a time (Up next), 1 done.
  expect(result.current.counts).toEqual({ all: 5, live: 1, next: 3, done: 1 });

  rerender({ filters: { ...base, tab: "all" } });

  await waitFor(() => expect(result.current.matches.map((m) => m.id)).toEqual(["m1", "m2", "m30", "m31", "m40"]));
  const allCalls = callsWith("all");
  expect(allCalls.filter((f) => f.pageSize === 100)).toEqual([
    expect.objectContaining({ status: "all", pageSize: 100, pageNumber: 1, tournament: "t1" }),
  ]);
  // Switching tabs reuses the counts: still the one counts call.
  expect(allCalls.filter((f) => f.pageSize === 1)).toHaveLength(1);
  expect(allCalls).toHaveLength(2);
  expect(result.current.counts.all).toBe(5);
  expect(result.current.hasMore).toBe(false);
});

test("All: Load more brings the next 100 and slots them into time order", async () => {
  const clock = (k: number) =>
    `2026-10-12T${String(8 + Math.floor(k / 60)).padStart(2, "0")}:${String(k % 60).padStart(2, "0")}:00`;
  const played = Array.from({ length: 60 }, (_, k) => ({ ...match(0), id: `p${k}`, startTime: clock(k), isCompleted: true }));
  const upcoming = Array.from({ length: 60 }, (_, k) => ({ ...match(0), id: `u${k}`, startTime: clock(60 + k) }));
  // The server sends the upcoming matches first, then the played ones.
  api.mockImplementation((f: MatchFilters) =>
    Promise.resolve(page([...upcoming, ...played], f.pageNumber!, f.pageSize!, { live: 0, next: 60, done: 60 }))
  );

  const { result } = renderHook(() => useMatchList("t1", { ...base, tab: "all" }), { wrapper: wrapper() });

  // The first 100: every upcoming match and the first 40 played ones, which come first in time order.
  await waitFor(() => expect(result.current.matches).toHaveLength(100));
  expect(result.current.matches.slice(0, 2).map((m) => m.id)).toEqual(["p0", "p1"]);
  expect(result.current.matches.slice(39, 41).map((m) => m.id)).toEqual(["p39", "u0"]);
  expect(result.current.counts.all).toBe(120);
  expect(result.current.hasMore).toBe(true);

  act(() => result.current.loadMore());

  await waitFor(() => expect(result.current.matches).toHaveLength(120));
  expect(result.current.matches.map((m) => m.id)).toEqual([...played, ...upcoming].map((m) => m.id));
  expect(callsWith("all").filter((f) => f.pageSize === 100).map((f) => f.pageNumber)).toEqual([1, 2]);
  expect(result.current.hasMore).toBe(false);
});
