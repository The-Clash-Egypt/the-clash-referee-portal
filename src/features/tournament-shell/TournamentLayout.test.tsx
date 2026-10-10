import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import userReducer, { User } from "../../store/slices/userSlice";
import { AdminRole } from "../auth/types/adminRoles";
import { getMexicanoStages } from "../mexicano/api/mexicano";
import { getTournaments } from "../tournaments/api";
import TournamentLayout from "./TournamentLayout";
import MorePage from "./MorePage";
import { FullAccessOnly } from "./guards";

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
jest.mock("../mexicano/api/mexicano", () => ({
  ...jest.requireActual("../mexicano/api/mexicano"),
  getMexicanoStages: jest.fn(),
}));
jest.mock("../tournaments/api", () => ({ getTournaments: jest.fn() }));

const stages = getMexicanoStages as jest.Mock;
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

const summerClash = {
  id: "t1",
  name: "Summer Clash Open",
  status: "active",
  type: "Beach Volleyball",
  categories: ["Men's Open"],
  startDate: "2026-10-09T00:00:00",
  endDate: "2026-10-11T00:00:00",
};

function renderAt(path: string, user: User) {
  const store = configureStore({
    reducer: { user: userReducer },
    preloadedState: { user: { user, token: "x", isAuthenticated: true } },
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <Provider store={store}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/" element={<p>Tournaments home</p>} />
            <Route path="/tournaments/:id" element={<TournamentLayout />}>
              <Route path="matches" element={<p>Matches page</p>} />
              <Route
                path="courts"
                element={
                  <FullAccessOnly>
                    <p>Courts page</p>
                  </FullAccessOnly>
                }
              />
              <Route path="mexicano" element={<p>Mexicano page</p>} />
              <Route path="more" element={<MorePage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
  return { ...view, store, client };
}

/** The labels of every tournament tab nav (the phone bottom bar and the wide-screen top nav), which must agree. */
const tabLabels = () => {
  const navs = screen.getAllByRole("navigation", { name: "Sections" });
  expect(navs).toHaveLength(2);
  const [first, ...rest] = navs.map((nav) => within(nav).getAllByRole("link").map((link) => link.textContent));
  rest.forEach((labels) => expect(labels).toEqual(first));
  return first;
};

beforeEach(() => {
  jest.resetAllMocks();
  tournaments.mockResolvedValue({ data: { data: [] } });
  stages.mockResolvedValue([]);
  window.scrollTo = jest.fn(); // jsdom doesn't implement it; the layout scrolls to the top on a tab change
});

it("shows a plain referee only the Matches and More tabs when the tournament has no Mexicano stage", async () => {
  renderAt("/tournaments/t1/matches?name=Summer%20Clash%20Open", referee);

  await waitFor(() => expect(stages).toHaveBeenCalledWith("t1"));
  await waitFor(() => expect(tournaments).toHaveBeenCalled());

  expect(screen.getByText("Matches page")).toBeInTheDocument();
  expect(tabLabels()).toEqual(["Matches", "More"]);
  // Not in the tournaments list: the title falls back to ?name=
  expect(screen.getByRole("heading", { name: "Summer Clash Open" })).toBeInTheDocument();
});

it("shows a superadmin Courts, and Mexicano once a stage exists", async () => {
  stages.mockResolvedValue([{ formatId: "m1", categoryName: "Men's A", stageName: "Mexicano" }]);

  renderAt("/tournaments/t1/matches", superadmin);

  await screen.findAllByRole("link", { name: "Mexicano" });
  expect(tabLabels()).toEqual(["Matches", "Courts", "Mexicano", "More"]);
});

it("sends a plain referee who opens the courts tab to the matches tab", async () => {
  renderAt("/tournaments/t1/courts?name=Summer%20Clash%20Open", referee);

  expect(await screen.findByText("Matches page")).toBeInTheDocument();
  expect(screen.queryByText("Courts page")).not.toBeInTheDocument();
  screen.getAllByRole("link", { name: "Matches" }).forEach((link) => expect(link).toHaveAttribute("aria-current", "page"));
});

it("titles the bar from the tournaments list and keeps the query string on the tab links", async () => {
  tournaments.mockResolvedValue({ data: { data: [summerClash] } });

  renderAt("/tournaments/t1/more?name=Old%20name", superadmin);

  expect(await screen.findByRole("heading", { name: "Summer Clash Open" })).toBeInTheDocument();
  expect(screen.getByText("Beach Volleyball · More")).toBeInTheDocument();
  screen
    .getAllByRole("link", { name: "Matches" })
    .forEach((link) => expect(link).toHaveAttribute("href", "/tournaments/t1/matches?name=Old%20name"));
});

it("logs out from More: clears the cached data and the user, then goes home", async () => {
  const { store, client } = renderAt("/tournaments/t1/more", referee);
  client.setQueryData(["referee-matches", "secret"], { rows: 1 });

  expect(await screen.findByText("Ahmed Kamal")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /switch tournament/i })).toHaveAttribute("href", "/");

  fireEvent.click(screen.getByRole("button", { name: /log out/i }));

  expect(await screen.findByText("Tournaments home")).toBeInTheDocument();
  expect(store.getState().user.isAuthenticated).toBe(false);
  expect(store.getState().user.user).toBeNull();
  expect(client.getQueryData(["referee-matches", "secret"])).toBeUndefined();
});
