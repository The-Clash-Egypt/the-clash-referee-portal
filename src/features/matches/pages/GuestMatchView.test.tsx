import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GuestMatchView } from "./GuestMatchView";
import { GuestMatch, getGuestMatch } from "../api/matchAccess";

jest.mock("../../../api/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("../api/matchAccess", () => ({
  ...jest.requireActual("../api/matchAccess"),
  getGuestMatch: jest.fn(),
  submitGuestMatchScore: jest.fn(),
}));

const load = getGuestMatch as jest.Mock;

const guest = (over: Partial<GuestMatch> = {}): GuestMatch => ({
  id: "m1",
  tournamentName: "Summer Open",
  categoryName: "Men's Open",
  formatName: "Pool A",
  formatType: "Group",
  round: "Round 1",
  venue: "Court 1",
  startTime: "2026-09-12T10:30:00Z",
  bestOf: 3,
  pointsPerMatch: null,
  pointsForDraw: null,
  isCompleted: false,
  homeTeamName: "Falcons",
  awayTeamName: "Sharks",
  homeTeam2Name: null,
  awayTeam2Name: null,
  homeTeamSets: 0,
  awayTeamSets: 0,
  gameScores: [],
  homeTeamPlayers: [],
  awayTeamPlayers: [],
  expiresAt: new Date(2026, 8, 11, 14, 32).toISOString(),
  ...over,
});

const renderView = (matchId = "m1", token = "tok") =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <GuestMatchView matchId={matchId} token={token} />
    </QueryClientProvider>
  );

beforeEach(() => load.mockReset());

it("offers score entry for a match still to be played", async () => {
  load.mockResolvedValue(guest());

  renderView();

  expect(await screen.findByRole("button", { name: "Enter score" })).toBeInTheDocument();
  expect(screen.getByText("This link works until Fri 11 Sep, 2:32 PM.")).toBeInTheDocument();
  expect(load).toHaveBeenCalledWith("m1", "tok");
});

it("is read-only once the match is completed", async () => {
  load.mockResolvedValue(
    guest({
      isCompleted: true,
      homeTeamSets: 2,
      awayTeamSets: 1,
      gameScores: [
        { gameNumber: 1, homeScore: 21, awayScore: 17 },
        { gameNumber: 2, homeScore: 18, awayScore: 21 },
        { gameNumber: 3, homeScore: 15, awayScore: 11 },
      ],
    })
  );

  renderView();

  expect(await screen.findByText(/Scores for this match are final/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Enter score" })).not.toBeInTheDocument();
});

it("waits until both teams are decided before offering score entry", async () => {
  load.mockResolvedValue(guest({ homeTeamName: null }));

  renderView();

  expect(await screen.findByText(/teams haven't been decided yet/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Enter score" })).not.toBeInTheDocument();
});

it("explains an expired QR", async () => {
  load.mockRejectedValue({ response: { status: 403, data: { reason: "expired" } } });

  renderView();

  expect(await screen.findByText("This QR code has expired. Ask the referee desk for a new one.")).toBeInTheDocument();
});

it("refuses a tampered link", async () => {
  load.mockRejectedValue({ response: { status: 403, data: { reason: "invalid" } } });

  renderView();

  expect(await screen.findByText("This link isn't valid. Ask the referee desk for a new QR code.")).toBeInTheDocument();
});

it("refuses a link with no token without calling the API", () => {
  renderView("m1", "");

  expect(screen.getByText("This link isn't valid. Ask the referee desk for a new QR code.")).toBeInTheDocument();
  expect(load).not.toHaveBeenCalled();
});
