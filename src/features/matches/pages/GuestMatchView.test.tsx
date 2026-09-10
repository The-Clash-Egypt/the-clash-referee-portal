import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GuestMatchView } from "./GuestMatchView";
import { GuestMatch, getGuestMatch, submitGuestMatchScore } from "../api/matchAccess";

jest.mock("../../../api/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("../api/matchAccess", () => ({
  ...jest.requireActual("../api/matchAccess"),
  getGuestMatch: jest.fn(),
  submitGuestMatchScore: jest.fn(),
}));
// Stubs UpdateScoreDialog so GuestMatchView's own handleSubmit/handleDialogClose are exercised
// without driving the real (heavy) scoring dialog. Mirrors its contract: onSubmit resolving
// closes it (onClose), onSubmit rejecting keeps it open.
jest.mock("../components/UpdateScoreDialog", () => ({
  __esModule: true,
  default: (props: { isOpen: boolean; onSubmit: (s: unknown[]) => Promise<void>; onClose: () => void }) =>
    props.isOpen ? (
      <button
        onClick={() =>
          props.onSubmit([{ gameNumber: 1, homeScore: 21, awayScore: 17 }]).then(props.onClose, () => undefined)
        }
      >
        Submit stub
      </button>
    ) : null,
}));

const load = getGuestMatch as jest.Mock;
const submitScore = submitGuestMatchScore as jest.Mock;

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

beforeEach(() => {
  load.mockReset();
  submitScore.mockReset();
});

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

it("shows a generic message for a server error", async () => {
  load.mockRejectedValue({ response: { status: 500, data: {} } });

  renderView();

  expect(
    await screen.findByText("Something went wrong on our side. Please try again in a moment.")
  ).toBeInTheDocument();
});

it("saves a score for a match that stays open", async () => {
  load.mockResolvedValueOnce(guest());
  submitScore.mockResolvedValueOnce(guest({ homeTeamSets: 1, gameScores: [{ gameNumber: 1, homeScore: 21, awayScore: 17 }] }));
  load.mockResolvedValueOnce(guest({ homeTeamSets: 1, gameScores: [{ gameNumber: 1, homeScore: 21, awayScore: 17 }] }));

  renderView();

  fireEvent.click(await screen.findByRole("button", { name: "Enter score" }));
  fireEvent.click(screen.getByRole("button", { name: "Submit stub" }));

  expect(await screen.findByText("Score saved.")).toBeInTheDocument();
  expect(submitScore).toHaveBeenCalledWith("m1", "tok", [{ gameNumber: 1, homeScore: 21, awayScore: 17 }]);
});

it("locks the page when a save completes the match", async () => {
  load.mockResolvedValueOnce(guest());
  const completed = guest({
    isCompleted: true,
    homeTeamSets: 2,
    awayTeamSets: 1,
    gameScores: [
      { gameNumber: 1, homeScore: 21, awayScore: 17 },
      { gameNumber: 2, homeScore: 18, awayScore: 21 },
      { gameNumber: 3, homeScore: 15, awayScore: 11 },
    ],
  });
  submitScore.mockResolvedValueOnce(completed);
  load.mockResolvedValueOnce(completed);

  renderView();

  fireEvent.click(await screen.findByRole("button", { name: "Enter score" }));
  fireEvent.click(screen.getByRole("button", { name: "Submit stub" }));

  expect(await screen.findByText(/Scores for this match are final/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Enter score" })).not.toBeInTheDocument();
});

it("explains a completed-match conflict on save and ends locked", async () => {
  load.mockResolvedValueOnce(guest());
  submitScore.mockRejectedValueOnce({ response: { status: 409, data: { reason: "completed" } } });
  load.mockResolvedValueOnce(guest({ isCompleted: true, homeTeamSets: 2, awayTeamSets: 0 }));

  renderView();

  fireEvent.click(await screen.findByRole("button", { name: "Enter score" }));
  fireEvent.click(screen.getByRole("button", { name: "Submit stub" }));

  expect(await screen.findByText("This match was already completed.")).toBeInTheDocument();
  expect(await screen.findByText(/Scores for this match are final/)).toBeInTheDocument();
});

it("explains an expired QR discovered on save and ends on the expired state", async () => {
  load.mockResolvedValueOnce(guest());
  submitScore.mockRejectedValueOnce({ response: { status: 403, data: { reason: "expired" } } });
  load.mockRejectedValueOnce({ response: { status: 403, data: { reason: "expired" } } });

  renderView();

  fireEvent.click(await screen.findByRole("button", { name: "Enter score" }));
  fireEvent.click(screen.getByRole("button", { name: "Submit stub" }));

  expect(
    await screen.findByText("This QR code has expired. Ask the referee desk for a new one.")
  ).toBeInTheDocument();
});

it("alerts on an unexpected save failure and keeps the dialog open", async () => {
  const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => undefined);
  load.mockResolvedValueOnce(guest());
  submitScore.mockRejectedValueOnce({
    response: { status: 400, data: { reason: "rejected", message: "Enter at least one game's score." } },
  });

  renderView();

  fireEvent.click(await screen.findByRole("button", { name: "Enter score" }));
  fireEvent.click(screen.getByRole("button", { name: "Submit stub" }));

  await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Enter at least one game's score."));
  expect(screen.getByRole("button", { name: "Submit stub" })).toBeInTheDocument();

  alertSpy.mockRestore();
});
