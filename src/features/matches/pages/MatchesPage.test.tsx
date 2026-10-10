import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import userReducer, { User } from "../../../store/slices/userSlice";
import { AdminRole } from "../../auth/types/adminRoles";
import { getMexicanoStages } from "../../mexicano/api/mexicano";
import { getTournaments } from "../../tournaments/api";
import { getRefereeMatches } from "../api/matches";
import { getRefereeTeamOptions } from "../api/refereeTeams";
import { MatchFilters } from "../types/match";
import TournamentLayout from "../../tournament-shell/TournamentLayout";
import MatchesPage from "./MatchesPage";

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
jest.mock("../../../api/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("../../mexicano/api/mexicano", () => ({
  ...jest.requireActual("../../mexicano/api/mexicano"),
  getMexicanoStages: jest.fn(),
}));
jest.mock("../../tournaments/api", () => ({ getTournaments: jest.fn() }));
jest.mock("../api/matches", () => ({ ...jest.requireActual("../api/matches"), getRefereeMatches: jest.fn() }));
jest.mock("../api/refereeTeams", () => ({ ...jest.requireActual("../api/refereeTeams"), getRefereeTeamOptions: jest.fn() }));

const api = getRefereeMatches as jest.Mock;

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

const ymd = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const today = ymd(new Date());
const yesterday = ymd(new Date(Date.now() - 86400000));

const liveMatch = {
  id: "m1",
  venue: "Court 1",
  startTime: new Date(Date.now() - 20 * 60000).toISOString(),
  startedAt: new Date(Date.now() - 18 * 60000).toISOString(),
  categoryName: "Men's Open",
  round: "Round of 16",
  homeTeamName: "Sand Sharks",
  awayTeamName: "Blue Wave",
  isCompleted: false,
  gameScores: [{ gameNumber: 1, homeScore: 9, awayScore: 7 }],
  referees: [],
  refereeTeams: [],
};

const respond = (items: object[], f: MatchFilters) => ({
  data: {
    success: true,
    data: {
      matches: { items, pagination: { total: items.length, pageNumber: f.pageNumber, pageSize: f.pageSize, totalPages: items.length ? 1 : 0 } },
      inProgressCount: 1,
      incomingCount: 2,
      completedCount: 0,
      filters: {
        tournaments: [],
        categories: ["Men's Open"],
        formats: [],
        rounds: ["Round of 16"],
        venues: ["Court 1", "Court 2"],
        teams: ["Sand Sharks", "Blue Wave"],
        referees: [],
        dates: [today, yesterday],
      },
    },
  },
});

const LocationProbe = () => <output data-testid="location">{useLocation().search}</output>;

function renderMatches(path: string, user: User) {
  const store = configureStore({
    reducer: { user: userReducer },
    preloadedState: { user: { user, token: "x", isAuthenticated: true } },
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/tournaments/:id" element={<TournamentLayout />}>
              <Route
                path="matches"
                element={
                  <>
                    <MatchesPage />
                    <LocationProbe />
                  </>
                }
              />
              <Route path="courts" element={<p>Courts page</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
}

const urlParams = () => new URLSearchParams(screen.getByTestId("location").textContent ?? "");

beforeEach(() => {
  jest.resetAllMocks();
  (getTournaments as jest.Mock).mockResolvedValue({ data: { data: [] } });
  (getMexicanoStages as jest.Mock).mockResolvedValue([]);
  (getRefereeTeamOptions as jest.Mock).mockResolvedValue([]);
  api.mockImplementation((f: MatchFilters) =>
    Promise.resolve(respond(f.status === "in-progress" ? [liveMatch] : f.status === "all" ? [liveMatch] : [], f))
  );
  window.scrollTo = jest.fn();
});

test("opens on today and on Live when something is live, with the search and Filters in the app bar", async () => {
  renderMatches("/tournaments/t1/matches?name=Summer%20Clash%20Open", referee);

  expect(await screen.findByText("Sand Sharks")).toBeInTheDocument();
  expect(urlParams().get("date")).toBe(today);
  expect(urlParams().get("status")).toBe("in-progress");
  expect(urlParams().get("name")).toBe("Summer Clash Open");
  expect(screen.getByRole("tab", { name: /live/i })).toHaveAttribute("aria-selected", "true");
  // The list asked for today's live matches, 30 at a time.
  expect(api).toHaveBeenCalledWith(expect.objectContaining({ status: "in-progress", date: today, pageSize: 30, pageNumber: 1 }));

  const bar = screen.getByRole("banner");
  expect(within(bar).getByRole("searchbox", { name: "Search matches" })).toBeInTheDocument();
  expect(within(bar).getByRole("button", { name: "Filters · 1" })).toBeInTheDocument();
  // Today's chip, removable
  expect(screen.getByRole("button", { name: /^Remove / })).toBeInTheDocument();
});

test("a plain referee's match sheet has Score and Share only", async () => {
  renderMatches("/tournaments/t1/matches?status=in-progress&date=all", referee);

  fireEvent.click(await screen.findByText("Sand Sharks"));
  const sheet = await screen.findByRole("dialog");
  expect(within(sheet).getByRole("button", { name: /^score$/i })).toBeInTheDocument();
  expect(within(sheet).getByRole("button", { name: "Share" })).toBeInTheDocument();
  expect(within(sheet).queryByRole("button", { name: "Referee" })).not.toBeInTheDocument();
  expect(within(sheet).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
});

test("full access: the sheet's Referee opens today's assign drawer in its place", async () => {
  renderMatches("/tournaments/t1/matches?status=in-progress&date=all", superadmin);

  fireEvent.click(await screen.findByText("Sand Sharks"));
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Referee" }));

  expect(await screen.findByRole("dialog", { name: "Referees" })).toBeInTheDocument();
});

test("filters: a court chip writes the URL; Clear filters on an empty result clears them", async () => {
  api.mockImplementation((f: MatchFilters) =>
    Promise.resolve(respond(f.status === "upcoming" && !f.venues ? [liveMatch] : f.status === "all" ? [liveMatch] : [], f))
  );
  renderMatches("/tournaments/t1/matches?status=upcoming&date=all&name=X", superadmin);

  expect(await screen.findByText("Sand Sharks")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  const sheet = await screen.findByRole("dialog");
  fireEvent.click(within(sheet).getByRole("button", { name: "C2" }));

  await waitFor(() => expect(urlParams().getAll("venues")).toEqual(["Court 2"]));
  expect(within(sheet).getByRole("button", { name: "Show 2 matches" })).toBeInTheDocument();
  fireEvent.click(within(sheet).getByRole("button", { name: "Show 2 matches" }));

  expect(await screen.findByText("No matches match your filters")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  await waitFor(() => expect(urlParams().getAll("venues")).toEqual([]));
  expect(urlParams().get("name")).toBe("X");
  expect(await screen.findByText("Sand Sharks")).toBeInTheDocument();
});

test("old ?tab=venues links still open the Courts tab", async () => {
  renderMatches("/tournaments/t1/matches?tab=venues&name=X", superadmin);
  expect(await screen.findByText("Courts page")).toBeInTheDocument();
});

// ---- Select mode (full access) ----

const LONG_PRESS_WAIT = { timeout: 1500 };

test("long-pressing a row as an admin starts select mode: 1 selected, and the bulk bar replaces the tabs", async () => {
  renderMatches("/tournaments/t1/matches?status=in-progress&date=all", superadmin);

  fireEvent.pointerDown(await screen.findByText("Sand Sharks"));

  expect(await screen.findByText("1 selected", {}, LONG_PRESS_WAIT)).toBeInTheDocument();
  const bar = screen.getByRole("group", { name: "Bulk actions" });
  ["Referee", "Scores", "Edit", "WhatsApp"].forEach((name) =>
    expect(within(bar).getByRole("button", { name })).toBeEnabled()
  );
  // The bar takes the tab bar's place (and the app bar's, with the tabs in it).
  expect(screen.queryByRole("navigation", { name: "Sections" })).not.toBeInTheDocument();
  expect(screen.queryByRole("searchbox", { name: "Search matches" })).not.toBeInTheDocument();

  // Rows are checkboxes now: a tap toggles instead of opening the match sheet.
  const row = screen.getByRole("checkbox", { name: /Sand Sharks/ });
  expect(row).toBeChecked();
  fireEvent.pointerDown(row);
  fireEvent.pointerUp(row);
  fireEvent.click(row);
  expect(screen.getByText("0 selected")).toBeInTheDocument();
  expect(within(bar).getByRole("button", { name: "Referee" })).toBeDisabled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

  // ✕ leaves select mode and gives the tabs back.
  fireEvent.click(screen.getByRole("button", { name: "Exit select mode" }));
  expect(screen.queryByRole("group", { name: "Bulk actions" })).not.toBeInTheDocument();
  expect(screen.getAllByRole("navigation", { name: "Sections" })).toHaveLength(2);
  expect(screen.getByRole("searchbox", { name: "Search matches" })).toBeInTheDocument();
});

test("a plain referee has no select mode: no Select button, and a long-press does nothing", async () => {
  renderMatches("/tournaments/t1/matches?status=in-progress&date=all", referee);

  const name = await screen.findByText("Sand Sharks");
  expect(screen.queryByRole("button", { name: "Select" })).not.toBeInTheDocument();
  fireEvent.pointerDown(name);
  await act(() => new Promise((resolve) => setTimeout(resolve, 700)));
  fireEvent.pointerUp(name);

  expect(screen.queryByText(/selected$/)).not.toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Bulk actions" })).not.toBeInTheDocument();
  expect(screen.getAllByRole("navigation", { name: "Sections" })).toHaveLength(2);
});

test("Select, then Select all, then the bulk bar's Referee opens the referee sheet for the selection", async () => {
  renderMatches("/tournaments/t1/matches?status=in-progress&date=all", superadmin);
  await screen.findByText("Sand Sharks");

  fireEvent.click(screen.getByRole("button", { name: "Select" }));
  expect(screen.getByText("0 selected")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Select all 1" }));
  expect(screen.getByText("1 selected")).toBeInTheDocument();

  fireEvent.click(within(screen.getByRole("group", { name: "Bulk actions" })).getByRole("button", { name: "Referee" }));
  expect(await screen.findByRole("dialog", { name: "Referees · 1 match" })).toBeInTheDocument();
  expect(getRefereeTeamOptions).toHaveBeenCalledWith(["m1"]);
});

test("changing the tab leaves select mode", async () => {
  renderMatches("/tournaments/t1/matches?status=in-progress&date=all", superadmin);
  await screen.findByText("Sand Sharks");

  fireEvent.click(screen.getByRole("button", { name: "Select" }));
  expect(screen.getByRole("group", { name: "Bulk actions" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: /up next/i }));

  await waitFor(() => expect(urlParams().get("status")).toBe("upcoming"));
  expect(screen.queryByRole("group", { name: "Bulk actions" })).not.toBeInTheDocument();
  expect(screen.getAllByRole("navigation", { name: "Sections" })).toHaveLength(2);
});
