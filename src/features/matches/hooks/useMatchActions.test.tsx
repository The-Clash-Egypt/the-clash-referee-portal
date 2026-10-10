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
    expect(await result.current.bulkEditMatches([{ matchId: "m1", venue: "Court 2" }], [match])).toBe(false);
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
