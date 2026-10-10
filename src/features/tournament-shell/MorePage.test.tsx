import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import userReducer, { User } from "../../store/slices/userSlice";
import { AdminRole } from "../auth/types/adminRoles";
import { getRefereeMatches } from "../matches/api/matches";
import { matchListKeys } from "../matches/hooks/useMatchList";
import { Match } from "../matches/types/match";
import { getTournaments } from "../tournaments/api";
import MorePage from "./MorePage";

// Jest 27 (CRA) can't resolve react-router-dom v7 (its "main" file is missing); react-router exports everything
// react-router-dom re-exports. It needs TextEncoder, which jsdom lacks.
jest.mock(
  "react-router-dom",
  () => {
    const { TextEncoder, TextDecoder } = jest.requireActual("util");
    Object.assign(global, { TextEncoder, TextDecoder });
    return jest.requireActual("react-router");
  },
  { virtual: true }
);
jest.mock("../../api/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("../matches/api/matches", () => ({
  ...jest.requireActual("../matches/api/matches"),
  getRefereeMatches: jest.fn(),
}));
jest.mock("../tournaments/api", () => ({ getTournaments: jest.fn() }));

const fetchMatches = getRefereeMatches as jest.Mock;
const tournaments = getTournaments as jest.Mock;

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
const superadmin: User = { ...referee, id: "u-admin", firstName: "Karim", lastName: "Adel", adminRoles: [AdminRole.SUPERADMIN] };

const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).toISOString();
const matches: Match[] = [
  { id: "m1", isCompleted: true, startedAt: at(11, 9), endedAt: at(11, 10, 5) },
  { id: "m2", isCompleted: true, startedAt: at(11, 17, 30), endedAt: at(11, 19, 10) },
  { id: "m3", isCompleted: true, startedAt: at(12, 9), endedAt: at(12, 18, 40) },
];

function renderMore(
  path: string,
  user: User,
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
) {
  const store = configureStore({
    reducer: { user: userReducer },
    preloadedState: { user: { user, token: "x", isAuthenticated: true } },
  });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/tournaments/:id/more" element={<MorePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
}

/** The preview the last window.open went to: its path and query. */
const openedPreview = (open: jest.SpyInstance) => {
  expect(open).toHaveBeenCalledTimes(1);
  const [url, target] = open.mock.calls[0];
  expect(target).toBe("_blank");
  return new URL(url as string, "http://portal.test");
};

let open: jest.SpyInstance;

beforeEach(() => {
  jest.resetAllMocks();
  tournaments.mockResolvedValue({
    data: { data: [{ id: "t1", name: "Summer Clash Open", status: "active", type: "Beach Volleyball", categories: [] }] },
  });
  fetchMatches.mockResolvedValue({
    data: {
      data: {
        matches: { items: matches, pagination: { total: 3, pageNumber: 1, pageSize: 1000, totalPages: 1 } },
        inProgressCount: 0,
        incomingCount: 0,
        completedCount: 3,
        filters: { referees: [{ id: "r1", fullName: "Mona Samir" }], teams: ["Sand Storm"], venues: ["Court 1"] },
      },
    },
  });
  open = jest.spyOn(window, "open").mockImplementation(() => null);
});

afterEach(() => open.mockRestore());

it("shows a plain referee no Print and no Day durations, and fetches nothing for them", async () => {
  renderMore("/tournaments/t1/more?name=Summer%20Clash%20Open", referee);

  expect(await screen.findByRole("heading", { name: "Account" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Print" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Day durations" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /match sheets with qr codes/i })).not.toBeInTheDocument();
  await waitFor(() => expect(tournaments).toHaveBeenCalled());
  expect(fetchMatches).not.toHaveBeenCalled();
});

it("shows full access the print menu and each day's duration", async () => {
  renderMore("/tournaments/t1/more", superadmin);

  expect(screen.getByRole("heading", { name: "Print" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /match sheets with qr codes/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /match lists/i })).toBeInTheDocument();

  const days = screen.getByRole("list", { name: "Day durations" });
  await waitFor(() => expect(within(days).getAllByRole("listitem")).toHaveLength(2));
  const [sunday, monday] = within(days).getAllByRole("listitem");
  expect(sunday).toHaveTextContent("Sun 11 Oct");
  expect(sunday).toHaveTextContent("09:00 – 19:10");
  expect(sunday).toHaveTextContent("10h 10m");
  expect(monday).toHaveTextContent("Mon 12 Oct");
  expect(monday).toHaveTextContent("9h 40m");
  expect(fetchMatches).toHaveBeenCalledWith({ tournament: "t1", status: "all", pageSize: 1000 });
});

it("prints the match sheets with today's export: the tournament name and the matches filters, every status", async () => {
  renderMore(
    "/tournaments/t1/more?name=Summer%20Clash%20Open&status=upcoming&date=2026-10-11&category=Men%27s%20Open",
    superadmin
  );
  await screen.findByText("Sun 11 Oct");

  fireEvent.click(screen.getByRole("button", { name: /match sheets with qr codes/i }));

  const preview = openedPreview(open);
  expect(preview.pathname).toBe("/tournaments/t1/matches/preview");
  expect(preview.searchParams.get("tournamentName")).toBe("Summer Clash Open");
  expect(preview.searchParams.get("viewType")).toBe("general");
  expect(preview.searchParams.get("date")).toBe("2026-10-11");
  expect(preview.searchParams.get("category")).toBe("Men's Open");
  expect(preview.searchParams.get("categoryName")).toBe("Men's Open");
  // The Matches tab (Live / Up next / Done) isn't a print filter.
  expect(preview.searchParams.has("status")).toBe(false);
});

it("prints the match sheets by court when courts are filtered, as the old export button did", async () => {
  renderMore("/tournaments/t1/more?venues=Court%201", superadmin);
  await screen.findByText("Sun 11 Oct");

  fireEvent.click(screen.getByRole("button", { name: /match sheets with qr codes/i }));

  const preview = openedPreview(open);
  expect(preview.searchParams.get("viewType")).toBe("venue");
  expect(preview.searchParams.getAll("venues")).toEqual(["Court 1"]);
  expect(preview.searchParams.getAll("venueNames")).toEqual(["Court 1"]);
});

it("prints a match list of the type picked in its sheet", async () => {
  renderMore("/tournaments/t1/more?referee=r1", superadmin);
  await screen.findByText("Sun 11 Oct");

  fireEvent.click(screen.getByRole("button", { name: /match lists/i }));
  const sheet = screen.getByRole("dialog", { name: "Match lists" });
  expect(within(sheet).getAllByRole("button", { name: /^by |^everything/i }).map((b) => b.textContent)).toEqual([
    "By court",
    "By referee",
    "By team",
    "Everything",
  ]);

  fireEvent.click(within(sheet).getByRole("button", { name: "By referee" }));

  const preview = openedPreview(open);
  expect(preview.pathname).toBe("/tournaments/t1/matches/preview");
  expect(preview.searchParams.get("viewType")).toBe("referee");
  expect(preview.searchParams.get("referee")).toBe("r1");
  expect(preview.searchParams.get("refereeName")).toBe("Mona Samir");
});

describe("naming the referee or team a print is filtered by", () => {
  it("takes the name from the Matches tab's cache while the durations call is still out", () => {
    fetchMatches.mockReturnValue(new Promise(() => {})); // the durations call never answers
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData([...matchListKeys.all, "counts", "t1", { referee: "r1" }], {
      filters: { referees: [{ id: "r1", fullName: "Mona Samir" }] },
    });
    renderMore("/tournaments/t1/more?referee=r1", superadmin, client);

    expect(screen.getByText(/Filters from Matches: Mona Samir/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /match sheets with qr codes/i }));

    const preview = openedPreview(open);
    expect(preview.searchParams.get("referee")).toBe("r1");
    expect(preview.searchParams.get("refereeName")).toBe("Mona Samir");
  });

  it("holds the prints until the name is in, rather than printing the id", async () => {
    let answer: (value: unknown) => void = () => {};
    fetchMatches.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    renderMore("/tournaments/t1/more?referee=r1", superadmin);

    const sheets = screen.getByRole("button", { name: /match sheets with qr codes/i });
    expect(sheets).toBeDisabled();
    expect(screen.getByRole("button", { name: /match lists/i })).toBeDisabled();
    fireEvent.click(sheets);
    expect(open).not.toHaveBeenCalled();

    answer({
      data: {
        data: {
          matches: { items: [], pagination: { total: 0, pageNumber: 1, pageSize: 1000, totalPages: 0 } },
          filters: { referees: [{ id: "r1", fullName: "Mona Samir" }], teams: [], venues: [] },
        },
      },
    });
    await waitFor(() => expect(sheets).toBeEnabled());
    fireEvent.click(sheets);
    expect(openedPreview(open).searchParams.get("refereeName")).toBe("Mona Samir");
  });
});
