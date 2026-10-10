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
  expect(result.current.counts).toEqual({ live: 2, next: 3, done: 0 });
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

  await waitFor(() => expect(result.current.matches).toHaveLength(5));
  expect(callsWith("completed")[0]).toEqual(expect.objectContaining({ pageNumber: 3, pageSize: 30 }));
  expect(result.current.matches.map((m) => m.id)).toEqual(["m65", "m64", "m63", "m62", "m61"]);
  expect(result.current.hasMore).toBe(true);

  act(() => result.current.loadMore());

  await waitFor(() => expect(result.current.matches).toHaveLength(35));
  expect(callsWith("completed")[1]).toEqual(expect.objectContaining({ pageNumber: 2 }));
  expect(result.current.matches[5].id).toBe("m60");
  expect(result.current.matches[34].id).toBe("m31");
  expect(result.current.hasMore).toBe(true);
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
  expect(result.current.counts).toEqual({ live: 0, next: 3, done: 1 });
  expect(callsWith("all").map((f) => f.pageSize)).toEqual([1, 30]);
});

test("waits while not enabled", async () => {
  api.mockImplementation((f: MatchFilters) => Promise.resolve(page([match(1)], 1, f.pageSize!, { live: 1, next: 0, done: 0 })));

  const { result } = renderHook(() => useMatchList("t1", base, { enabled: false }), { wrapper: wrapper() });

  await waitFor(() => expect(result.current.counts.live).toBe(1));
  expect(callsWith("in-progress")).toHaveLength(0);
  expect(result.current.isLoading).toBe(true);
});

test("a failed counts call is an error (nothing to work the defaults out from)", async () => {
  api.mockImplementation((f: MatchFilters) =>
    f.status === "all" ? Promise.reject(new Error("offline")) : Promise.resolve(page([match(1)], 1, f.pageSize!))
  );

  const { result } = renderHook(() => useMatchList("t1", base, { enabled: false }), { wrapper: wrapper() });

  await waitFor(() => expect(result.current.isError).toBe(true));
});
