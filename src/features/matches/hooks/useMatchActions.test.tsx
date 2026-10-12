import React from "react";
import { act, renderHook, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import userReducer, { User } from "../../../store/slices/userSlice";
import { ToastProvider } from "../../../ui/Toast";
import { AdminRole } from "../../auth/types/adminRoles";
import { assignRefereeToMatch, bulkAssignRefereeToMatches, unassignRefereeFromMatch, updateGroupMatch } from "../api/matches";
import { assignRefereeTeams, unassignRefereeTeam } from "../api/refereeTeams";
import { Match } from "../types/match";
import { useMatchActions } from "./useMatchActions";

jest.mock("../../../api/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("../api/matches", () => ({
  ...jest.requireActual("../api/matches"),
  assignRefereeToMatch: jest.fn(),
  bulkAssignRefereeToMatches: jest.fn(),
  unassignRefereeFromMatch: jest.fn(),
  updateGroupMatch: jest.fn(),
}));
jest.mock("../api/refereeTeams", () => ({
  ...jest.requireActual("../api/refereeTeams"),
  assignRefereeTeams: jest.fn(),
  unassignRefereeTeam: jest.fn(),
}));

const referee: User = {
  id: "u-ref",
  firstName: "Ahmed",
  lastName: "Kamal",
  username: "ahmed.kamal",
  email: "ahmed.kamal@example.com",
  accountType: "referee",
  emailVerified: true,
  role: "referee",
  adminRoles: [],
};
const superadmin: User = { ...referee, id: "u-admin", adminRoles: [AdminRole.SUPERADMIN] };

const match = { id: "m1", formatType: "Group", homeTeamName: "Sand Sharks", awayTeamName: "Blue Wave", isCompleted: false } as Match;

const apiCalls = [
  assignRefereeToMatch,
  bulkAssignRefereeToMatches,
  unassignRefereeFromMatch,
  updateGroupMatch,
  assignRefereeTeams,
  unassignRefereeTeam,
] as jest.Mock[];

function renderActions(user: User) {
  const store = configureStore({
    reducer: { user: userReducer },
    preloadedState: { user: { user, token: "x", isAuthenticated: true } },
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = jest.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>
      <QueryClientProvider client={client}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    </Provider>
  );
  const { result } = renderHook(() => useMatchActions("t1"), { wrapper });
  return { result, invalidate };
}

beforeEach(() => {
  jest.resetAllMocks();
  apiCalls.forEach((call) => call.mockResolvedValue({ data: {} }));
  (assignRefereeTeams as jest.Mock).mockResolvedValue([]);
});

test("a plain referee changes nothing: no request goes out, and each action says it didn't happen", async () => {
  const { result } = renderActions(referee);

  await act(async () => {
    expect(await result.current.assignReferees(match, ["u-mona"])).toBe(false);
    expect(await result.current.bulkAssignReferees(["u-mona"], ["m1"])).toBe(false);
    expect(await result.current.unassignReferee("r1", "m1")).toBe(false);
    expect(await result.current.unassignTeam("m1", "t1")).toBe(false);
    expect(await result.current.assignTeams(["t1"], ["m1"])).toBeNull();
    expect(await result.current.editMatch(match, { venue: "Court 2" })).toBe(false);
    expect(await result.current.bulkEditMatches([{ matchId: "m1", venue: "Court 2" }], [match])).toEqual([
      { matchId: "m1", ok: false, error: "Not allowed." },
    ]);
  });

  apiCalls.forEach((call) => expect(call).not.toHaveBeenCalled());
});

test("full access: today's requests with the right ids, then the matches list refreshes", async () => {
  const { result, invalidate } = renderActions(superadmin);
  const refreshedList = () => expect(invalidate).toHaveBeenLastCalledWith({ queryKey: ["referee-matches"] });

  await act(async () => {
    expect(await result.current.assignReferees(match, ["u-mona", "u-omar"])).toBe(true);
  });
  expect(assignRefereeToMatch).toHaveBeenCalledWith("u-mona", "m1");
  expect(assignRefereeToMatch).toHaveBeenCalledWith("u-omar", "m1");
  refreshedList();

  await act(async () => {
    expect(await result.current.unassignReferee("r1", "m1")).toBe(true);
  });
  expect(unassignRefereeFromMatch).toHaveBeenCalledWith("r1", "m1");
  refreshedList();

  await act(async () => {
    expect(await result.current.unassignTeam("m1", "t1")).toBe(true);
  });
  expect(unassignRefereeTeam).toHaveBeenCalledWith("m1", "t1");
  refreshedList();

  await act(async () => {
    expect(await result.current.editMatch(match, { venue: "Court 2" })).toBe(true);
  });
  expect(updateGroupMatch).toHaveBeenCalledWith("m1", { venue: "Court 2" });
  refreshedList();
});

test("a failed unassign resolves false and says why in an error toast", async () => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  (unassignRefereeFromMatch as jest.Mock).mockRejectedValue(new Error("offline"));
  const { result } = renderActions(superadmin);

  await act(async () => {
    expect(await result.current.unassignReferee("r1", "m1")).toBe(false);
  });
  expect(screen.getByRole("alert")).toHaveTextContent("Failed to unassign referee. Please try again.");
  (console.error as jest.Mock).mockRestore();
});

describe("bulk edit", () => {
  const tenAm = { ...match, id: "m1", startTime: "2026-10-12T08:00:00.000Z" };
  const tenThirty = { ...match, id: "m2", startTime: "2026-10-12T08:30:00.000Z" };
  const elevenAm = { ...match, id: "m3", startTime: "2026-10-12T09:00:00.000Z" };
  const later = (from: string) => new Date(Date.parse(from) + 30 * 60_000).toISOString();

  test("saves one match at a time, the latest first when moving later, and reports each one", async () => {
    const saved: string[] = [];
    let inFlight = 0;
    let mostAtOnce = 0;
    (updateGroupMatch as jest.Mock).mockImplementation(async (matchId: string) => {
      inFlight += 1;
      mostAtOnce = Math.max(mostAtOnce, inFlight);
      saved.push(matchId);
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlight -= 1;
      return { data: {} };
    });
    const { result, invalidate } = renderActions(superadmin);

    let results: unknown;
    await act(async () => {
      results = await result.current.bulkEditMatches(
        [tenAm, tenThirty, elevenAm].map((m) => ({ matchId: m.id, startTime: later(m.startTime!), venue: "Court 2" })),
        [tenAm, tenThirty, elevenAm]
      );
    });

    // 30 minutes later on one court: 10:30 can only take 11:00 once the 11:00 match has moved on, so 11:00 goes first.
    expect(saved).toEqual(["m3", "m2", "m1"]);
    expect(mostAtOnce).toBe(1);
    expect(updateGroupMatch).toHaveBeenNthCalledWith(1, "m3", { startTime: "2026-10-12T09:30:00.000Z", venue: "Court 2" });
    expect(results).toEqual([
      { matchId: "m1", ok: true },
      { matchId: "m2", ok: true },
      { matchId: "m3", ok: true },
    ]);
    expect(invalidate).toHaveBeenLastCalledWith({ queryKey: ["referee-matches"] });
    expect(result.current.bulkEditingMatches).toBe(false);
  });

  test("moving earlier: the earliest first", async () => {
    const { result } = renderActions(superadmin);
    const earlier = (from: string) => new Date(Date.parse(from) - 30 * 60_000).toISOString();

    await act(async () => {
      await result.current.bulkEditMatches(
        [elevenAm, tenAm, tenThirty].map((m) => ({ matchId: m.id, startTime: earlier(m.startTime!) })),
        [tenAm, tenThirty, elevenAm]
      );
    });

    expect((updateGroupMatch as jest.Mock).mock.calls.map(([matchId]) => matchId)).toEqual(["m1", "m2", "m3"]);
  });

  test("a failed match doesn't stop the rest; each failure says why, and the list still refreshes", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const taken = "There is already a match scheduled at the same time at 'Court 1': Falcons vs Sharks";
    (updateGroupMatch as jest.Mock).mockImplementation((matchId: string) =>
      matchId === "m2" ? Promise.reject({ response: { data: { message: taken } } }) : Promise.resolve({ data: {} })
    );
    const unknownFormat = { ...match, id: "m9", formatType: "Swiss" } as Match;
    const { result, invalidate } = renderActions(superadmin);

    let results: unknown;
    await act(async () => {
      results = await result.current.bulkEditMatches(
        [
          { matchId: "m1", bestOf: 3 },
          { matchId: "m2", bestOf: 3 },
          { matchId: "m3", bestOf: 3 },
          { matchId: "m9", bestOf: 3 },
        ],
        [tenAm, tenThirty, elevenAm, unknownFormat]
      );
    });

    // No time changes: the given order.
    expect((updateGroupMatch as jest.Mock).mock.calls.map(([matchId]) => matchId)).toEqual(["m1", "m2", "m3"]);
    expect(results).toEqual([
      { matchId: "m1", ok: true },
      { matchId: "m2", ok: false, error: taken },
      { matchId: "m3", ok: true },
      { matchId: "m9", ok: false, error: "This match's format can't be edited here." },
    ]);
    expect(invalidate).toHaveBeenLastCalledWith({ queryKey: ["referee-matches"] });
    (console.error as jest.Mock).mockRestore();
  });
});
