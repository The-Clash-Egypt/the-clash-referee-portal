import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import userReducer, { User } from "../../store/slices/userSlice";
import { AdminRole } from "../auth/types/adminRoles";
import { getRefereeMatches } from "../matches/api/matches";
import { Match } from "../matches/types/match";
import { getTournamentDayDuration, groupMatchesByDay } from "../../utils/durationUtils";
import { useDayDurations } from "./useDayDurations";

jest.mock("../matches/api/matches", () => ({ getRefereeMatches: jest.fn() }));

const fetchMatches = getRefereeMatches as jest.Mock;

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
const refereeAdmin: User = { ...referee, id: "u-admin", adminRoles: [AdminRole.REFEREE_ADMIN] };

/** A local time on a day of October 2026, as the ISO string the API sends. */
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).toISOString();

const match = (id: string, fields: Partial<Match>): Match => ({ id, isCompleted: false, ...fields });

// Out of order on purpose: the rows come out by day all the same.
const matches: Match[] = [
  match("m4", { startTime: at(12, 9), startedAt: at(12, 9), endedAt: at(12, 9, 50), isCompleted: true }),
  match("m5", { startTime: at(12, 17), startedAt: at(12, 17), endedAt: at(12, 18, 40), isCompleted: true }),
  match("m1", { startTime: at(11, 9), startedAt: at(11, 9), endedAt: at(11, 10, 5), isCompleted: true }),
  match("m2", { startTime: at(11, 17, 30), startedAt: at(11, 17, 30), endedAt: at(11, 19, 10), isCompleted: true }),
  // Live: started, not ended — no end time to measure the day by.
  match("m3", { startTime: at(11, 12), startedAt: at(11, 12) }),
  // A day with nothing finished has no duration, so no row.
  match("m6", { startTime: at(10, 10), startedAt: at(10, 10) }),
  // Not started.
  match("m7", { startTime: at(13, 9) }),
];

function renderDurations(user: User, tournamentId = "t1") {
  const store = configureStore({
    reducer: { user: userReducer },
    preloadedState: { user: { user, token: "x", isAuthenticated: true } },
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </Provider>
  );
  return renderHook(() => useDayDurations(tournamentId), { wrapper });
}

beforeEach(() => {
  jest.resetAllMocks();
  fetchMatches.mockResolvedValue({
    data: {
      data: {
        matches: { items: matches, pagination: { total: matches.length, pageNumber: 1, pageSize: 1000, totalPages: 1 } },
        inProgressCount: 1,
        incomingCount: 1,
        completedCount: 4,
        filters: { referees: [{ id: "r1", fullName: "Mona Samir" }], teams: ["Sand Storm"], venues: ["Court 1"] },
      },
    },
  });
});

it("fetches all of the tournament's matches once and gives one row per day with a duration", async () => {
  const { result } = renderDurations(refereeAdmin);

  await waitFor(() => expect(result.current.rows).toHaveLength(2));

  expect(fetchMatches).toHaveBeenCalledTimes(1);
  expect(fetchMatches).toHaveBeenCalledWith({ tournament: "t1", status: "all", pageSize: 1000 });
  expect(result.current.rows.map(({ day, range, duration }) => ({ day, range, duration }))).toEqual([
    { day: "Sun 11 Oct", range: "09:00 – 19:10", duration: "10h 10m" },
    { day: "Mon 12 Oct", range: "09:00 – 18:40", duration: "9h 40m" },
  ]);

  // The durations are the existing util's, day by day.
  const byDay = groupMatchesByDay(matches);
  expect(result.current.rows.map((row) => row.duration)).toEqual(
    [new Date(2026, 9, 11).toDateString(), new Date(2026, 9, 12).toDateString()].map((key) =>
      getTournamentDayDuration(byDay[key])
    )
  );
  expect(result.current.enabled).toBe(true);
  expect(result.current.isError).toBe(false);
  // The same call names the print filters (the whole tournament's teams and referees).
  expect(result.current.filterOptions.referees).toEqual([{ id: "r1", fullName: "Mona Samir" }]);
});

it("is disabled for a plain referee: nothing is fetched and there are no rows", async () => {
  const { result } = renderDurations(referee);

  // Give a would-be request the chance to start.
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(fetchMatches).not.toHaveBeenCalled();
  expect(result.current.enabled).toBe(false);
  expect(result.current.isLoading).toBe(false);
  expect(result.current.rows).toEqual([]);
});

it("reports a failed call as an error, without rows", async () => {
  fetchMatches.mockRejectedValue(new Error("Network Error"));

  const { result } = renderDurations(refereeAdmin);

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.rows).toEqual([]);
  expect(result.current.isLoading).toBe(false);
});
