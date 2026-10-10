import React from "react";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useMatchFilters } from "./useMatchFilters";

// Jest 27 (CRA) can't resolve react-router-dom v7; react-router exports the same API (it needs TextEncoder).
jest.mock(
  "react-router-dom",
  () => {
    const { TextEncoder, TextDecoder } = jest.requireActual("util");
    Object.assign(global, { TextEncoder, TextDecoder });
    return jest.requireActual("react-router");
  },
  { virtual: true }
);

const setup = (url: string) =>
  renderHook(() => ({ ...useMatchFilters(), location: useLocation() }), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>,
  });

const params = (search: string) => new URLSearchParams(search);

afterEach(() => {
  jest.useRealTimers();
});

test("setting a filter writes the URL param and clearAll keeps name", () => {
  const { result } = setup("/tournaments/t1/matches?name=Summer%20Clash%20Open&status=upcoming");

  act(() => result.current.setFilter("category", "Men's Open"));
  expect(params(result.current.location.search).get("category")).toBe("Men's Open");
  expect(result.current.filters.category).toBe("Men's Open");
  expect(params(result.current.location.search).get("name")).toBe("Summer Clash Open");

  act(() => result.current.setFilter("venues", ["Court 1", "Court 2"]));
  expect(params(result.current.location.search).getAll("venues")).toEqual(["Court 1", "Court 2"]);
  expect(result.current.activeCount).toBe(3);

  act(() => result.current.clearAll());
  const cleared = params(result.current.location.search);
  expect(cleared.get("name")).toBe("Summer Clash Open");
  expect(cleared.get("category")).toBeNull();
  expect(cleared.getAll("venues")).toEqual([]);
  // The tab is not a filter; the day is explicitly "all" so the today default doesn't come back.
  expect(cleared.get("status")).toBe("upcoming");
  expect(cleared.get("date")).toBe("all");
  expect(result.current.filters).toMatchObject({ tab: "next", category: "all", venues: [], date: "all", search: "" });
  expect(result.current.activeCount).toBe(0);
});

test("reads the tab, an old single venue and explicit defaults from the URL", () => {
  const { result } = setup("/m?venue=Court%203&status=completed&date=2026-10-12&team=Sand%20Sharks&referee=r1");
  expect(result.current.filters).toMatchObject({
    tab: "done",
    venues: ["Court 3"],
    date: "2026-10-12",
    team: "Sand Sharks",
    referee: "r1",
    category: "all",
  });
  expect(result.current.hasExplicitTab).toBe(true);
  expect(result.current.hasExplicitDate).toBe(true);
  expect(result.current.activeCount).toBe(4);

  const fresh = setup("/m?name=X");
  expect(fresh.result.current.hasExplicitTab).toBe(false);
  expect(fresh.result.current.hasExplicitDate).toBe(false);
  expect(fresh.result.current.filters.date).toBe("all");
});

test("the tab maps to the API status param", () => {
  const { result } = setup("/m?name=X");
  act(() => result.current.setFilter("tab", "done"));
  expect(params(result.current.location.search).get("status")).toBe("completed");
  expect(result.current.hasExplicitTab).toBe(true);
  act(() => result.current.setFilter("date", "all"));
  expect(params(result.current.location.search).get("date")).toBe("all");
  expect(result.current.hasExplicitDate).toBe(true);
});

test("search reaches the URL 300 ms after the last keystroke", () => {
  jest.useFakeTimers();
  const { result } = setup("/m?name=X");

  act(() => result.current.setFilter("search", "sha"));
  expect(result.current.searchInput).toBe("sha");
  expect(params(result.current.location.search).get("search")).toBeNull();

  act(() => {
    jest.advanceTimersByTime(200);
  });
  act(() => result.current.setFilter("search", "shar"));
  act(() => {
    jest.advanceTimersByTime(200);
  });
  expect(params(result.current.location.search).get("search")).toBeNull();

  act(() => {
    jest.advanceTimersByTime(150);
  });
  expect(params(result.current.location.search).get("search")).toBe("shar");
  expect(result.current.filters.search).toBe("shar");
  expect(result.current.searchInput).toBe("shar");
});

// Task 10 (owner): the All tab lives in the same `status` param, as "all" (the API's own value for no status filter).
test("the All tab round-trips through status=all", () => {
  const { result } = setup("/m?name=X&status=all&date=all");
  expect(result.current.filters.tab).toBe("all");
  expect(result.current.hasExplicitTab).toBe(true);

  act(() => result.current.setFilter("tab", "live"));
  expect(params(result.current.location.search).get("status")).toBe("in-progress");
  expect(result.current.filters.tab).toBe("live");

  act(() => result.current.setFilter("tab", "all"));
  expect(params(result.current.location.search).get("status")).toBe("all");
  expect(result.current.filters.tab).toBe("all");
  expect(result.current.hasExplicitTab).toBe(true);
  // The tab is not a filter.
  expect(result.current.activeCount).toBe(0);
});
