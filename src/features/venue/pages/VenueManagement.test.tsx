import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import VenueManagement from "./VenueManagement";
import { getFilteredVenues } from "../api/venue";
import { Venue } from "../types/venue";

jest.mock("../../../api/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("../api/venue", () => ({
  ...jest.requireActual("../api/venue"),
  getFilteredVenues: jest.fn(),
}));

const loadCourts = getFilteredVenues as jest.Mock;

const court: Venue = {
  id: "v1",
  name: "Court 1",
  isLocked: false,
  tournamentId: "t1",
  createdAt: "2026-10-05T10:00:00",
  password: null,
  accessToken: "token-v1",
  accessTokenExpiry: null,
  totalMatchCount: 18,
  completedMatchCount: 12,
};
const courts = { data: { data: [court], success: true, message: "", errors: [] } };

const renderCourts = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <VenueManagement tournamentId="t1" />
    </QueryClientProvider>
  );
  return client;
};

beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => undefined));
afterEach(() => jest.restoreAllMocks());

// Review part 2, M7: the courts stay on screen, but their locks and passwords may be out of date — say so.
it("keeps the courts on screen when a refresh fails, says so, and Try again refreshes them", async () => {
  loadCourts.mockResolvedValueOnce(courts);
  const client = renderCourts();
  expect(await screen.findByRole("article", { name: "Court 1" })).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();

  loadCourts.mockRejectedValueOnce(new Error("Network Error"));
  await act(async () => {
    await client.refetchQueries();
  });

  expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load courts. Please try again.");
  expect(screen.getByRole("article", { name: "Court 1" })).toBeInTheDocument();

  loadCourts.mockResolvedValueOnce(courts);
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  expect(screen.getByRole("article", { name: "Court 1" })).toBeInTheDocument();
});

it("shows the full-page error when the courts never loaded", async () => {
  loadCourts.mockRejectedValueOnce(new Error("Network Error"));
  renderCourts();

  expect(await screen.findByRole("heading", { name: "Error" })).toBeInTheDocument();
  expect(screen.getByText("Failed to load courts. Please try again.")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
