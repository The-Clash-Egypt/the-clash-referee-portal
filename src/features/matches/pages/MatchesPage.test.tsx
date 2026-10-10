import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import userReducer, { User } from "../../../store/slices/userSlice";
import { AdminRole } from "../../auth/types/adminRoles";
import { getMexicanoStages } from "../../mexicano/api/mexicano";
import { getTournaments } from "../../tournaments/api";
import { ToastProvider } from "../../../ui/Toast";
import { assignRefereeToMatch, getPlayerSuggestions, getRefereeMatches, unassignRefereeFromMatch } from "../api/matches";
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
jest.mock("../api/matches", () => ({
  ...jest.requireActual("../api/matches"),
  getRefereeMatches: jest.fn(),
  getPlayerSuggestions: jest.fn(),
  assignRefereeToMatch: jest.fn(),
  unassignRefereeFromMatch: jest.fn(),
}));
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

/** The browser's Back button (MemoryRouter keeps the history). */
const HistoryBack = () => {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      Browser back
    </button>
  );
};

function renderMatches(path: string, user: User) {
  const store = configureStore({
    reducer: { user: userReducer },
    preloadedState: { user: { user, token: "x", isAuthenticated: true } },
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <Provider store={store}>
      <QueryClientProvider client={client}>
        <ToastProvider>
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
                <Route
                  path="courts"
                  element={
                    <>
                      <p>Courts page</p>
                      <HistoryBack />
                    </>
                  }
                />
              </Route>
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </Provider>
  );
  return { ...view, client };
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

// ---- Changes go through today's API, and the sheets hand over cleanly ----

const apiCalls = () => api.mock.calls.length;

// Review C1: Score, Referee, QR code and Edit close the match sheet and open their own in the same render.
test("an action opened from the match sheet takes its place; closing it gives the page back its scroll and focus", async () => {
  renderMatches("/tournaments/t1/matches?status=in-progress&date=all", superadmin);
  const row = await screen.findByRole("button", { name: /Sand Sharks/ });
  row.focus();
  fireEvent.click(row);
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Referee" }));

  const sheet = await screen.findByRole("dialog", { name: "Referees" });
  // The match sheet slides out under it: the page stays still, and keyboard focus stays in the sheet that's open.
  await waitFor(() => expect(screen.getAllByRole("dialog")).toHaveLength(1));
  expect(document.body.style.overflow).toBe("hidden");
  expect(sheet).toHaveFocus();

  fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(document.body.style.overflow).not.toBe("hidden");
  expect(row).toHaveFocus();
});

// Review I1
test("a refresh that fails keeps the list on screen, with a way to try again", async () => {
  const { client } = renderMatches("/tournaments/t1/matches?status=in-progress&date=all", referee);
  expect(await screen.findByText("Sand Sharks")).toBeInTheDocument();
  const online = api.getMockImplementation()!;

  api.mockRejectedValue(new Error("offline"));
  await act(() => client.refetchQueries());

  expect(await screen.findByText("An error occurred while loading data")).toBeInTheDocument();
  expect(screen.getByText("Sand Sharks")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Error" })).not.toBeInTheDocument();

  api.mockImplementation(online);
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(screen.queryByText("An error occurred while loading data")).not.toBeInTheDocument());
  expect(screen.getByText("Sand Sharks")).toBeInTheDocument();
});

test("a first load that fails is the full-page error", async () => {
  api.mockRejectedValue(new Error("offline"));
  renderMatches("/tournaments/t1/matches?status=in-progress&date=all", referee);

  expect(await screen.findByRole("heading", { name: "Error" })).toBeInTheDocument();
  expect(screen.getByText("An error occurred while loading data")).toBeInTheDocument();
});

// Review M2 + M10: the match sheet's ✕ unassigns at once (as the old match card did), through today's API call.
test("full access: the match sheet's ✕ unassigns a referee with the referee's and the match's ids, refreshes and says so", async () => {
  const confirm = jest.spyOn(window, "confirm");
  const refereed = {
    ...liveMatch,
    referees: [{ id: "r1", userId: "u-mona", fullName: "Mona Salah", email: "mona@example.com", phoneNumber: "201001234567" }],
  };
  api.mockImplementation((f: MatchFilters) => Promise.resolve(respond(f.status === "upcoming" ? [] : [refereed], f)));
  (unassignRefereeFromMatch as jest.Mock).mockResolvedValue({ data: {} });
  renderMatches("/tournaments/t1/matches?status=in-progress&date=all", superadmin);

  fireEvent.click(await screen.findByText("Sand Sharks"));
  const sheet = await screen.findByRole("dialog");
  const before = apiCalls();
  fireEvent.click(within(sheet).getByRole("button", { name: "Unassign Mona Salah" }));

  expect(await screen.findByText("Mona Salah unassigned.")).toBeInTheDocument();
  expect(unassignRefereeFromMatch).toHaveBeenCalledWith("r1", "m1");
  expect(apiCalls()).toBeGreaterThan(before); // the list and its counts refreshed
  expect(confirm).not.toHaveBeenCalled();
  confirm.mockRestore();
});

test("full access: a referee picked in the referee sheet is assigned by user and match id, then the list refreshes and the sheet closes", async () => {
  (getPlayerSuggestions as jest.Mock).mockResolvedValue({
    data: { data: [{ id: "p1", userId: "u-mona", firstName: "Mona", lastName: "Salah", email: "mona@example.com" }] },
  });
  (assignRefereeToMatch as jest.Mock).mockResolvedValue({ data: {} });
  renderMatches("/tournaments/t1/matches?status=in-progress&date=all", superadmin);

  fireEvent.click(await screen.findByText("Sand Sharks"));
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Referee" }));
  const sheet = await screen.findByRole("dialog", { name: "Referees" });
  fireEvent.change(within(sheet).getByRole("searchbox", { name: "Search name, email or team" }), { target: { value: "mo" } });
  fireEvent.click(await within(sheet).findByText("Mona Salah"));
  const before = apiCalls();
  fireEvent.click(within(sheet).getByRole("button", { name: "Assign 1 Referee" }));

  await waitFor(() => expect(assignRefereeToMatch).toHaveBeenCalledWith("u-mona", "m1"));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(apiCalls()).toBeGreaterThan(before);
});

// ---- Task 10 (owner): an All tab next to Live · Up next · Done ----

const nextMatch = {
  ...liveMatch,
  id: "m2",
  venue: "Court 2",
  startTime: new Date(Date.now() + 40 * 60000).toISOString(),
  startedAt: undefined,
  homeTeamName: "Net Ninjas",
  awayTeamName: "Spike Club",
  gameScores: [],
};
const doneMatch = {
  ...liveMatch,
  id: "m3",
  venue: "Court 3",
  startTime: new Date(Date.now() - 120 * 60000).toISOString(),
  startedAt: new Date(Date.now() - 118 * 60000).toISOString(),
  homeTeamName: "Dune Dogs",
  awayTeamName: "Salty Six",
  isCompleted: true,
  homeScore: 2,
  awayScore: 0,
  gameScores: [
    { gameNumber: 1, homeScore: 21, awayScore: 12 },
    { gameNumber: 2, homeScore: 21, awayScore: 17 },
  ],
};

/** One live, one upcoming and one finished match; status "all" lists them as the server does: upcoming first. */
const respondThree = (f: MatchFilters) => {
  const items =
    f.status === "in-progress" ? [liveMatch] : f.status === "upcoming" ? [nextMatch] : f.status === "completed" ? [doneMatch] : [nextMatch, doneMatch, liveMatch];
  const response = respond(items, f);
  Object.assign(response.data.data, { inProgressCount: 1, incomingCount: 1, completedCount: 1 });
  return response;
};

const rowTexts = () => Array.from(document.querySelectorAll(".match-row")).map((row) => row.textContent ?? "");
const tabTexts = () => screen.getAllByRole("tab").map((tab) => tab.textContent);
const countsCalls = () => api.mock.calls.filter(([f]) => f.status === "all" && f.pageSize === 1);

test("four tabs, All first, each with its count; status=all opens All: every match in time order, 100 at a time", async () => {
  api.mockImplementation((f: MatchFilters) => Promise.resolve(respondThree(f)));
  renderMatches("/tournaments/t1/matches?status=all&date=all", referee);

  expect(await screen.findByText("Net Ninjas")).toBeInTheDocument();
  expect(tabTexts()).toEqual(["All 3", "Live 1", "Up next 1", "Done 1"]);
  expect(screen.getByRole("tab", { name: /^All/ })).toHaveAttribute("aria-selected", "true");
  expect(urlParams().get("status")).toBe("all");
  expect(api).toHaveBeenCalledWith(expect.objectContaining({ status: "all", pageSize: 100, pageNumber: 1, tournament: "t1" }));

  // Played, live, upcoming: time order, though the server sent the upcoming match first.
  const rows = rowTexts();
  expect(rows).toHaveLength(3);
  expect(rows[0]).toMatch(/Dune Dogs.*Salty Six/);
  expect(rows[1]).toMatch(/Sand Sharks.*Blue Wave/);
  expect(rows[2]).toMatch(/Net Ninjas.*Spike Club/);
  // The live match keeps its live tag, the finished one its scores; rows name their courts in full.
  expect(screen.getByText("Live · Set 1")).toBeInTheDocument();
  expect(screen.getAllByText("21")).toHaveLength(2);
  expect(screen.getByTitle("Court 3")).toHaveTextContent(/^Court 3$/);
});

test("tapping All writes status=all and reuses the counts; the Filters sheet shows the All count", async () => {
  api.mockImplementation((f: MatchFilters) => Promise.resolve(respondThree(f)));
  renderMatches("/tournaments/t1/matches?status=in-progress&date=all", referee);
  expect(await screen.findByText("Sand Sharks")).toBeInTheDocument();
  expect(countsCalls()).toHaveLength(1);

  fireEvent.click(screen.getByRole("tab", { name: /^All/ }));

  await waitFor(() => expect(urlParams().get("status")).toBe("all"));
  expect(await screen.findByText("Net Ninjas")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /^All/ })).toHaveAttribute("aria-selected", "true");
  expect(countsCalls()).toHaveLength(1);

  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  expect(within(await screen.findByRole("dialog")).getByRole("button", { name: "Show 3 matches" })).toBeInTheDocument();
});

test("All is never the tab a tournament opens on", async () => {
  api.mockImplementation((f: MatchFilters) => Promise.resolve(respondThree(f)));
  renderMatches("/tournaments/t1/matches?date=all", referee);

  await waitFor(() => expect(urlParams().get("status")).toBe("in-progress"));
  expect(screen.getByRole("tab", { name: /^Live/ })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tab", { name: /^All/ })).toHaveAttribute("aria-selected", "false");
});

test("All comes back after leaving the page: Back, or the Matches tab", async () => {
  api.mockImplementation((f: MatchFilters) => Promise.resolve(respondThree(f)));
  renderMatches("/tournaments/t1/matches?status=all&date=all&name=X", superadmin);
  expect(await screen.findByText("Net Ninjas")).toBeInTheDocument();

  const courtsLink = () => within(screen.getAllByRole("navigation", { name: "Sections" })[0]).getByRole("link", { name: /courts/i });
  fireEvent.click(courtsLink());
  expect(await screen.findByText("Courts page")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Browser back" }));

  expect(await screen.findByText("Net Ninjas")).toBeInTheDocument();
  expect(urlParams().get("status")).toBe("all");
  expect(screen.getByRole("tab", { name: /^All/ })).toHaveAttribute("aria-selected", "true");

  fireEvent.click(courtsLink());
  expect(await screen.findByText("Courts page")).toBeInTheDocument();
  fireEvent.click(within(screen.getAllByRole("navigation", { name: "Sections" })[0]).getByRole("link", { name: /matches/i }));

  expect(await screen.findByText("Net Ninjas")).toBeInTheDocument();
  expect(urlParams().get("status")).toBe("all");
  expect(screen.getByRole("tab", { name: /^All/ })).toHaveAttribute("aria-selected", "true");
});

test("select mode works on All", async () => {
  api.mockImplementation((f: MatchFilters) => Promise.resolve(respondThree(f)));
  renderMatches("/tournaments/t1/matches?status=all&date=all", superadmin);
  await screen.findByText("Net Ninjas");

  fireEvent.click(screen.getByRole("button", { name: "Select" }));
  fireEvent.click(screen.getByRole("button", { name: "Select all 3" }));

  expect(screen.getByText("3 selected")).toBeInTheDocument();
  expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(3);
});

// ---- Task 10 (owner): "when a tournament is done, open the matches tab on the done filter" ----

const dayAt = (daysAgo: number) => `${ymd(new Date(Date.now() - daysAgo * 86400000))}T00:00:00`;
const finishedTournament = {
  id: "t1",
  name: "Summer Clash Open",
  status: "completed",
  categories: [],
  startDate: dayAt(4),
  endDate: dayAt(2),
};
/** A finished tournament: its matches were days ago, one of them never closed (so it still counts as live). */
const respondFinished = (f: MatchFilters) => {
  const response = respondThree(f);
  response.data.data.filters.dates = [dayAt(2).slice(0, 10), dayAt(3).slice(0, 10)];
  return response;
};

test("a tournament that is over opens on Done, all days, even beside a match nobody closed", async () => {
  (getTournaments as jest.Mock).mockResolvedValue({ data: { data: [finishedTournament] } });
  api.mockImplementation((f: MatchFilters) => Promise.resolve(respondFinished(f)));
  renderMatches("/tournaments/t1/matches?name=Summer%20Clash%20Open", referee);

  await waitFor(() => expect(urlParams().get("status")).toBe("completed"));
  expect(urlParams().get("date")).toBe("all");
  expect(screen.getByRole("tab", { name: /^Done/ })).toHaveAttribute("aria-selected", "true");
  expect(await screen.findByText("Dune Dogs")).toBeInTheDocument();
  expect(api).toHaveBeenCalledWith(expect.objectContaining({ status: "completed", pageSize: 30 }));
  expect(api).not.toHaveBeenCalledWith(expect.objectContaining({ status: "in-progress" }));
});

test("the default tab waits for the tournament's dates", async () => {
  let resolveTournaments: (value: unknown) => void = () => undefined;
  (getTournaments as jest.Mock).mockReturnValue(
    new Promise((resolve) => {
      resolveTournaments = resolve;
    })
  );
  api.mockImplementation((f: MatchFilters) => Promise.resolve(respondFinished(f)));
  renderMatches("/tournaments/t1/matches?date=all", referee);

  // The counts are in, but whether the tournament is over isn't known yet: no tab is picked.
  expect(await screen.findByRole("tab", { name: /^Done 1/ })).toBeInTheDocument();
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  expect(urlParams().get("status")).toBeNull();

  await act(async () => resolveTournaments({ data: { data: [finishedTournament] } }));
  await waitFor(() => expect(urlParams().get("status")).toBe("completed"));
});

test("a status in the URL always wins over the default, over or not", async () => {
  (getTournaments as jest.Mock).mockResolvedValue({ data: { data: [finishedTournament] } });
  api.mockImplementation((f: MatchFilters) => Promise.resolve(respondFinished(f)));
  renderMatches("/tournaments/t1/matches?status=upcoming&date=all", referee);

  expect(await screen.findByText("Net Ninjas")).toBeInTheDocument();
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  expect(urlParams().get("status")).toBe("upcoming");
  expect(screen.getByRole("tab", { name: /^Up next/ })).toHaveAttribute("aria-selected", "true");
  expect(api).not.toHaveBeenCalledWith(expect.objectContaining({ status: "completed" }));
});

test("during the event, with only finished matches left, the tab opens on Done", async () => {
  api.mockImplementation((f: MatchFilters) => {
    const response = respond(f.status === "completed" || f.status === "all" ? [doneMatch] : [], f);
    Object.assign(response.data.data, { inProgressCount: 0, incomingCount: 0, completedCount: 1 });
    return Promise.resolve(response);
  });
  renderMatches("/tournaments/t1/matches?date=all", referee);

  await waitFor(() => expect(urlParams().get("status")).toBe("completed"));
  expect(await screen.findByText("Dune Dogs")).toBeInTheDocument();
});
