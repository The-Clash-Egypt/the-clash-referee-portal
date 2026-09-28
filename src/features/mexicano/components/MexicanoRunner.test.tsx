import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import MexicanoRunner from "./MexicanoRunner";
import {
  finishMexicano,
  getMexicanoSession,
  startNextMexicanoRound,
  undoMexicanoRound,
  updateMexicanoPlayers,
} from "../api/mexicano";
import { updateMatchByFormat } from "../../matches/api/matches";
import { MexicanoPlayer, MexicanoSession, MexicanoStatus } from "../types";
import { Match } from "../../matches/types/match";

jest.mock("../../../api/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("../api/mexicano", () => ({
  ...jest.requireActual("../api/mexicano"),
  getMexicanoSession: jest.fn(),
  updateMexicanoPlayers: jest.fn(),
  startNextMexicanoRound: jest.fn(),
  undoMexicanoRound: jest.fn(),
  finishMexicano: jest.fn(),
}));
jest.mock("../../matches/api/matches", () => ({
  ...jest.requireActual("../../matches/api/matches"),
  updateMatchByFormat: jest.fn(),
}));

const load = getMexicanoSession as jest.Mock;
const updatePlayers = updateMexicanoPlayers as jest.Mock;
const start = startNextMexicanoRound as jest.Mock;
const undo = undoMexicanoRound as jest.Mock;
const finish = finishMexicano as jest.Mock;
const saveScore = updateMatchByFormat as jest.Mock;

const player = (name: string, status: MexicanoStatus, rank = 1, points = 0): MexicanoPlayer => ({
  teamId: `t-${name}`,
  name,
  members: [name],
  status,
  rank,
  points,
  played: 0,
  sitOuts: 0,
});

const court = (id: string, venue: string, over: Partial<Match> = {}): Match => ({
  id,
  venue,
  round: "Round 1",
  formatType: "Mexicano",
  pointsPerMatch: 24,
  bestOf: 1,
  homeTeamName: "Ali",
  homeTeam2Name: "Dee",
  awayTeamName: "Bea",
  awayTeam2Name: "Cy",
  gameScores: [],
  referees: [],
  refereeTeams: [],
  isCompleted: false,
  ...over,
});

const session = (over: Partial<MexicanoSession> = {}): MexicanoSession => ({
  formatId: "f1",
  tournamentId: "tour1",
  categoryName: "Men's Open",
  stageName: "Evening Mexicano",
  plannedRounds: 8,
  courts: 2,
  pointsPerMatch: 24,
  unitSize: 1,
  currentRound: 0,
  currentRoundScored: 0,
  currentRoundTotal: 0,
  ended: false,
  canStartNextRound: false,
  nextRoundBlockedReason: "Need at least 4 playing — 3 are marked Playing.",
  canUndoRound: false,
  canFinish: false,
  players: [
    player("Ali", MexicanoStatus.Playing),
    player("Bea", MexicanoStatus.Playing),
    player("Cy", MexicanoStatus.Playing),
    player("Dee", MexicanoStatus.NotHere),
  ],
  rounds: [],
  ...over,
});

const roundOne = (over: Partial<MexicanoSession> = {}) =>
  session({
    currentRound: 1,
    currentRoundScored: 0,
    currentRoundTotal: 1,
    canStartNextRound: false,
    nextRoundBlockedReason: "1 match in Round 1 still needs a score.",
    canUndoRound: true,
    players: session().players.map((p) => ({ ...p, status: MexicanoStatus.Playing })),
    rounds: [{ number: 1, matches: [court("m1", "Court 1")], sittingOut: [] }],
    ...over,
  });

const renderRunner = (canRun = true) =>
  render(<MexicanoRunner formatId="f1" canRun={canRun} onBack={jest.fn()} pollMs={0} />);

const statusButton = (name: string, label: "Not here" | "Playing" | "Sit out") =>
  within(screen.getByRole("group", { name: `${name} status` })).getByRole("button", { name: label });

beforeEach(() => {
  jest.resetAllMocks();
  window.alert = jest.fn();
  window.confirm = jest.fn(() => true);
});

it("opens on Players before round 1 and says why the round can't start yet", async () => {
  load.mockResolvedValue(session());
  renderRunner();

  expect(await screen.findByRole("heading", { name: "Men's Open" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Players" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByText("Not started")).toBeInTheDocument();
  expect(screen.getByText("3 playing · 0 sitting out · 1 not here")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Start round 1" })).toBeDisabled();
  expect(screen.getByText("Need at least 4 playing — 3 are marked Playing.")).toBeInTheDocument();
});

it("checks a late arrival in with one tap, and puts the old status back if the save fails", async () => {
  load.mockResolvedValue(session());
  updatePlayers.mockResolvedValueOnce(
    session({ players: session().players.map((p) => ({ ...p, status: MexicanoStatus.Playing })) })
  );
  renderRunner();
  await screen.findByRole("heading", { name: "Men's Open" });

  fireEvent.click(statusButton("Dee", "Playing"));

  expect(updatePlayers).toHaveBeenCalledWith("f1", [{ teamId: "t-Dee", status: MexicanoStatus.Playing }]);
  await waitFor(() => expect(statusButton("Dee", "Playing")).toHaveAttribute("aria-pressed", "true"));

  updatePlayers.mockRejectedValueOnce({
    response: { data: { message: "The event has finished — player statuses can no longer change." } },
  });
  fireEvent.click(statusButton("Dee", "Sit out"));

  await waitFor(() =>
    expect(window.alert).toHaveBeenCalledWith("The event has finished — player statuses can no longer change.")
  );
  expect(statusButton("Dee", "Playing")).toHaveAttribute("aria-pressed", "true");
});

it("marks everyone who isn't here yet as playing in one request", async () => {
  load.mockResolvedValue(session());
  updatePlayers.mockResolvedValue(
    session({ players: session().players.map((p) => ({ ...p, status: MexicanoStatus.Playing })) })
  );
  renderRunner();
  await screen.findByRole("heading", { name: "Men's Open" });

  fireEvent.click(screen.getByRole("button", { name: "Mark everyone playing" }));

  expect(updatePlayers).toHaveBeenCalledWith("f1", [{ teamId: "t-Dee", status: MexicanoStatus.Playing }]);
  expect(await screen.findByText("4 playing · 0 sitting out · 0 not here")).toBeInTheDocument();
});

it("lets plain referees see the players but not change them or run rounds", async () => {
  load.mockResolvedValue(session());
  renderRunner(false);
  await screen.findByRole("heading", { name: "Men's Open" });

  expect(statusButton("Dee", "Playing")).toBeDisabled();
  expect(screen.queryByRole("button", { name: /Start round/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Mark everyone playing" })).not.toBeInTheDocument();
});

it("starting a round shows its courts on the Round tab", async () => {
  load.mockResolvedValue(session({ canStartNextRound: true, nextRoundBlockedReason: null }));
  start.mockResolvedValue(
    roundOne({ rounds: [{ number: 1, matches: [court("m1", "Court 1")], sittingOut: ["t-Dee"] }] })
  );
  renderRunner();
  await screen.findByRole("heading", { name: "Men's Open" });

  fireEvent.click(screen.getByRole("button", { name: "Start round 1" }));

  expect(start).toHaveBeenCalledWith("f1");
  await waitFor(() => expect(screen.getByRole("tab", { name: "Round" })).toHaveAttribute("aria-selected", "true"));
  expect(screen.getByText("Court 1")).toBeInTheDocument();
  expect(screen.getByText("Sitting out this round: Dee")).toBeInTheDocument();
  expect(screen.getByText("Waiting for scores (0 of 1 in)")).toBeInTheDocument();
});

it("shows the server's reason when a round can't start", async () => {
  load.mockResolvedValue(session({ canStartNextRound: true, nextRoundBlockedReason: null }));
  start.mockRejectedValue({ response: { data: { message: "Round 1 has already been started." } } });
  renderRunner();
  await screen.findByRole("heading", { name: "Men's Open" });

  fireEvent.click(screen.getByRole("button", { name: "Start round 1" }));

  await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Round 1 has already been started."));
  expect(load).toHaveBeenCalledTimes(2); // re-reads the session so the page shows what really happened
});

it("asks before undoing or finishing, and only acts on a yes", async () => {
  load.mockResolvedValue(roundOne({ canFinish: true }));
  undo.mockResolvedValue(session());
  finish.mockResolvedValue(roundOne({ ended: true, canUndoRound: false, canFinish: false }));
  renderRunner();
  await screen.findByRole("heading", { name: "Men's Open" });

  (window.confirm as jest.Mock).mockReturnValueOnce(false);
  fireEvent.click(screen.getByRole("button", { name: "More actions" }));
  fireEvent.click(screen.getByRole("button", { name: "Undo round" }));
  expect(window.confirm).toHaveBeenCalled();
  expect(undo).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "More actions" }));
  fireEvent.click(screen.getByRole("button", { name: "Finish early" }));
  await waitFor(() => expect(finish).toHaveBeenCalledWith("f1"));
});

it("a finished event shows Finished and no controls", async () => {
  load.mockResolvedValue(roundOne({ ended: true, canUndoRound: false, nextRoundBlockedReason: "The event has finished." }));
  renderRunner();
  await screen.findByRole("heading", { name: "Men's Open" });

  expect(screen.getByText("Finished")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Start round/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "More actions" })).not.toBeInTheDocument();
});

it("Update Score opens the score dialog for that court", async () => {
  load.mockResolvedValue(roundOne());
  saveScore.mockResolvedValue(undefined);
  renderRunner(false);
  await screen.findByText("Court 1");

  fireEvent.click(screen.getByRole("button", { name: "Update Score" }));

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(load).toHaveBeenCalledTimes(1);
});
