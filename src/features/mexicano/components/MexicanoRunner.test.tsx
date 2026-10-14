import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import MexicanoRunner from "./MexicanoRunner";
import {
  createMexicanoUnit,
  dissolveMexicanoUnit,
  finishMexicano,
  getMexicanoSession,
  renameMexicanoUnit,
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
  createMexicanoUnit: jest.fn(),
  dissolveMexicanoUnit: jest.fn(),
  renameMexicanoUnit: jest.fn(),
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
const create = createMexicanoUnit as jest.Mock;
const dissolve = dissolveMexicanoUnit as jest.Mock;
const rename = renameMexicanoUnit as jest.Mock;

const player = (name: string, status: MexicanoStatus, rank = 1, points = 0): MexicanoPlayer => ({
  teamId: `t-${name}`,
  name,
  members: [name],
  status,
  rank,
  points,
  played: 0,
  sitOuts: 0,
  hasMatches: false,
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
  unpaired: [],
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
  window.prompt = jest.fn(() => null);
});

it("opens on Players before round 1 and says why the round can't start yet", async () => {
  load.mockResolvedValue(session());
  renderRunner();

  expect(await screen.findByRole("heading", { name: "Men's Open" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Players" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByText("Not started")).toBeInTheDocument();
  expect(screen.getByText("3 playing")).toBeInTheDocument();
  expect(screen.getByText("0 sitting out")).toBeInTheDocument();
  expect(screen.getByText("1 not here")).toBeInTheDocument();
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
  expect(await screen.findByText("4 playing")).toBeInTheDocument();
  expect(screen.getByText("0 sitting out")).toBeInTheDocument();
  expect(screen.getByText("0 not here")).toBeInTheDocument();
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
  expect(screen.getByText(/^Sitting out:/)).toHaveTextContent("Sitting out: Dee");
  // The status, split as in the mockup: the count in the bar's tag, the words over the courts.
  expect(screen.getByText("Waiting for scores")).toBeInTheDocument();
  expect(screen.getByText("0 of 1 in")).toBeInTheDocument();
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

it("Score opens the score dialog for that court", async () => {
  load.mockResolvedValue(roundOne());
  saveScore.mockResolvedValue(undefined);
  renderRunner(false);
  await screen.findByText("Court 1");

  fireEvent.click(screen.getByRole("button", { name: "Score" }));

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(load).toHaveBeenCalledTimes(1);
});

it("offers Score on open courts to everyone, and on finished ones only to organizers", async () => {
  const finished = court("m2", "Court 2", {
    isCompleted: true,
    gameScores: [{ gameNumber: 1, homeScore: 14, awayScore: 10 }],
  });
  load.mockResolvedValue(roundOne({ rounds: [{ number: 1, matches: [court("m1", "Court 1"), finished], sittingOut: [] }] }));
  const referee = renderRunner(false);
  await screen.findByText("Court 2");

  expect(screen.getAllByRole("button", { name: "Score" })).toHaveLength(1);
  expect(screen.getByText("14")).toBeInTheDocument(); // a Mexicano court shows its points, not games won
  expect(screen.getByText("10")).toBeInTheDocument();
  referee.unmount();

  renderRunner(true);
  await screen.findByText("Court 2");
  expect(screen.getAllByRole("button", { name: "Score" })).toHaveLength(2);
});

it("names the stage and round in the bar, with how many scores are in", async () => {
  load.mockResolvedValue(roundOne());
  renderRunner();

  expect(await screen.findByText("Evening Mexicano · Round 1 of 8")).toBeInTheDocument();
  expect(screen.getByText("0 of 1 in")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Back to Mexicano" })).toBeInTheDocument();
});

// ── review follow-ups ──

it("lists players by name so rows don't move when scores change mid-round", async () => {
  load.mockResolvedValue(
    session({
      players: [
        player("Zed", MexicanoStatus.Playing, 1, 40),
        player("Ali", MexicanoStatus.Playing, 2, 30),
        player("Mo", MexicanoStatus.NotHere, 3, 0),
      ],
    })
  );
  renderRunner();
  await screen.findByRole("heading", { name: "Men's Open" });

  const groups = screen.getAllByRole("group").map((g) => g.getAttribute("aria-label"));
  expect(groups).toEqual(["Ali status", "Mo status", "Zed status"]);
});

it("holds Start while a status change is still saving", async () => {
  load.mockResolvedValue(session({ canStartNextRound: true, nextRoundBlockedReason: null }));
  let finishSave: (s: MexicanoSession) => void = () => {};
  updatePlayers.mockReturnValue(new Promise<MexicanoSession>((resolve) => (finishSave = resolve)));
  renderRunner();
  await screen.findByRole("heading", { name: "Men's Open" });

  fireEvent.click(statusButton("Dee", "Playing"));
  expect(screen.getByRole("button", { name: "Start round 1" })).toBeDisabled();

  finishSave(session({ canStartNextRound: true, nextRoundBlockedReason: null }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Start round 1" })).toBeEnabled());
});

it("never lets an older reply overwrite a newer one", async () => {
  load.mockResolvedValue(session());
  let finishFirst: (s: MexicanoSession) => void = () => {};
  updatePlayers
    .mockReturnValueOnce(new Promise<MexicanoSession>((resolve) => (finishFirst = resolve)))
    .mockResolvedValueOnce(
      session({
        players: session().players.map((p) =>
          p.name === "Cy" ? { ...p, status: MexicanoStatus.SitOut } : p.name === "Dee" ? { ...p, status: MexicanoStatus.Playing } : p
        ),
      })
    );
  renderRunner();
  await screen.findByRole("heading", { name: "Men's Open" });

  fireEvent.click(statusButton("Dee", "Playing")); // slow
  fireEvent.click(statusButton("Cy", "Sit out")); // fast, answered first
  await waitFor(() => expect(statusButton("Cy", "Sit out")).toHaveAttribute("aria-pressed", "true"));

  finishFirst(session()); // the stale answer arrives last
  await waitFor(() => expect(updatePlayers).toHaveBeenCalledTimes(2));
  expect(statusButton("Cy", "Sit out")).toHaveAttribute("aria-pressed", "true");
});

it("closes the ⋯ menu when a round starts, so Undo can't target the new round by mistake", async () => {
  load.mockResolvedValue(roundOne({ canStartNextRound: true, nextRoundBlockedReason: null, canUndoRound: false, canFinish: true }));
  start.mockResolvedValue(roundOne({ currentRound: 2, canFinish: false }));
  renderRunner();
  await screen.findByRole("heading", { name: "Men's Open" });

  fireEvent.click(screen.getByRole("button", { name: "More actions" }));
  expect(screen.getByRole("button", { name: "Finish early" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Start round 2" }));

  expect(screen.queryByRole("button", { name: "Finish early" })).not.toBeInTheDocument();
  await waitFor(() => expect(start).toHaveBeenCalled());
});

it("warns before Undo that sit-out marks cleared by the round aren't restored", async () => {
  load.mockResolvedValue(roundOne());
  (window.confirm as jest.Mock).mockReturnValue(false);
  renderRunner();
  await screen.findByRole("heading", { name: "Men's Open" });

  fireEvent.click(screen.getByRole("button", { name: "More actions" }));
  fireEvent.click(screen.getByRole("button", { name: "Undo round" }));

  expect((window.confirm as jest.Mock).mock.calls[0][0]).toMatch(/Sit out/);
});

it("a stage with no players says it isn't set up yet", async () => {
  load.mockResolvedValue(session({ players: [] }));
  renderRunner();

  expect(await screen.findByText("No players yet. Set up this stage in the dashboard first.")).toBeInTheDocument();
  expect(screen.queryByText(/No one matches/)).not.toBeInTheDocument();
});

const pairSession = (over: Partial<MexicanoSession> = {}) =>
  session({
    unitSize: 2,
    players: [
      { ...player("Ali / Bea", MexicanoStatus.Playing), members: ["Ali", "Bea"] },
      { ...player("Cy / Dee", MexicanoStatus.Playing, 2), members: ["Cy", "Dee"], hasMatches: true },
    ],
    unpaired: [
      { memberId: "m5", name: "Eve" },
      { memberId: "m6", name: "Fay" },
      { memberId: "m7", name: "Gus" },
    ],
    ...over,
  });

/** The server's answer once Eve and Fay are a team. */
const afterPairing = () =>
  pairSession({
    players: [
      ...pairSession().players,
      { ...player("Eve / Fay", MexicanoStatus.Playing, 3), teamId: "t-new", members: ["Eve", "Fay"] },
    ],
    unpaired: [{ memberId: "m7", name: "Gus" }],
  });

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const pool = () => screen.getByRole("list", { name: "Needs a partner" });
const tray = () => screen.queryByRole("region", { name: "New team" });

it("pairs two players with two taps: they leave the list at once and the team comes back with Undo", async () => {
  load.mockResolvedValue(pairSession());
  const reply = deferred<MexicanoSession>();
  create.mockReturnValue(reply.promise);
  renderRunner();

  await screen.findByText("Needs a partner · 3");
  fireEvent.click(within(pool()).getByRole("button", { name: "Eve" }));
  expect(within(tray()!).getByRole("button", { name: "Remove Eve" })).toBeInTheDocument();
  expect(within(tray()!).getByText("+ 1 more")).toBeInTheDocument();

  fireEvent.click(within(pool()).getByRole("button", { name: "Fay" }));
  expect(create).toHaveBeenCalledWith("f1", ["m5", "m6"], "");
  expect(tray()).not.toBeInTheDocument();
  expect(within(pool()).queryByRole("button", { name: "Eve" })).not.toBeInTheDocument();
  expect(within(pool()).queryByRole("button", { name: "Fay" })).not.toBeInTheDocument();

  reply.resolve(afterPairing());
  expect(await screen.findByRole("button", { name: "Undo Eve / Fay" })).toBeInTheDocument();
  expect(screen.getByText("Gus still needs a partner.")).toBeInTheDocument();
});

it("a pick can be taken back from the tray", async () => {
  load.mockResolvedValue(pairSession());
  renderRunner();

  await screen.findByText("Needs a partner · 3");
  fireEvent.click(within(pool()).getByRole("button", { name: "Eve" }));
  fireEvent.click(within(tray()!).getByRole("button", { name: "Remove Eve" }));

  expect(tray()).not.toBeInTheDocument();
  expect(within(pool()).getByRole("button", { name: "Eve" })).toHaveAttribute("aria-pressed", "false");
  expect(create).not.toHaveBeenCalled();
});

it("a refused pairing puts the players back and says why", async () => {
  load.mockResolvedValue(pairSession());
  create.mockRejectedValue({ response: { data: { message: "One of those players is already in a team." } } });
  renderRunner();

  await screen.findByText("Needs a partner · 3");
  fireEvent.click(within(pool()).getByRole("button", { name: "Eve" }));
  fireEvent.click(within(pool()).getByRole("button", { name: "Fay" }));

  await waitFor(() => expect(window.alert).toHaveBeenCalledWith("One of those players is already in a team."));
  expect(within(pool()).getByRole("button", { name: "Eve" })).toBeInTheDocument();
  expect(within(pool()).getByRole("button", { name: "Fay" })).toBeInTheDocument();
});

it("Undo breaks the new team up without asking", async () => {
  load.mockResolvedValue(pairSession());
  create.mockResolvedValue(afterPairing());
  dissolve.mockResolvedValue(pairSession());
  renderRunner();

  await screen.findByText("Needs a partner · 3");
  fireEvent.click(within(pool()).getByRole("button", { name: "Eve" }));
  fireEvent.click(within(pool()).getByRole("button", { name: "Fay" }));
  fireEvent.click(await screen.findByRole("button", { name: "Undo Eve / Fay" }));

  await waitFor(() => expect(dissolve).toHaveBeenCalledWith("f1", "t-new"));
  expect(window.confirm).not.toHaveBeenCalled();
  expect(await within(pool()).findByRole("button", { name: "Eve" })).toBeInTheDocument();
});

it("one search finds players and teams, and clears after a pairing", async () => {
  load.mockResolvedValue(pairSession());
  create.mockResolvedValue(afterPairing());
  renderRunner();

  await screen.findByText("Needs a partner · 3");
  const search = screen.getByRole("searchbox", { name: "Search players and teams" });
  fireEvent.change(search, { target: { value: "bea" } });
  expect(screen.getByText("Ali / Bea")).toBeInTheDocument();
  expect(screen.queryByText("Cy / Dee")).not.toBeInTheDocument();
  expect(within(pool()).queryByRole("button", { name: "Eve" })).not.toBeInTheDocument();

  fireEvent.change(search, { target: { value: "eve" } });
  fireEvent.click(within(pool()).getByRole("button", { name: "Eve" }));
  fireEvent.change(search, { target: { value: "fay" } });
  fireEvent.click(within(pool()).getByRole("button", { name: "Fay" }));

  expect(search).toHaveValue("");
  await screen.findByRole("button", { name: "Undo Eve / Fay" });
});

it("picks survive switching tabs", async () => {
  load.mockResolvedValue(pairSession());
  renderRunner();

  await screen.findByText("Needs a partner · 3");
  fireEvent.click(within(pool()).getByRole("button", { name: "Eve" }));
  fireEvent.click(screen.getByRole("tab", { name: "Leaderboard" }));
  fireEvent.click(screen.getByRole("tab", { name: "Players" }));

  expect(within(tray()!).getByRole("button", { name: "Remove Eve" })).toBeInTheDocument();
  expect(within(pool()).getByRole("button", { name: "Eve" })).toHaveAttribute("aria-pressed", "true");
});

it("hides pairing for single-player stages, non-organizers and finished events", async () => {
  load.mockResolvedValue(session());
  const { unmount } = renderRunner();
  await screen.findByRole("heading", { name: "Men's Open" });
  expect(screen.queryByText(/Needs a partner/)).not.toBeInTheDocument();
  unmount();

  load.mockResolvedValue(pairSession());
  const second = renderRunner(false);
  await screen.findByRole("heading", { name: "Men's Open" });
  expect(screen.queryByText(/Needs a partner/)).not.toBeInTheDocument();
  second.unmount();

  load.mockResolvedValue(pairSession({ ended: true }));
  renderRunner();
  await screen.findByRole("heading", { name: "Men's Open" });
  expect(screen.queryByText(/Needs a partner/)).not.toBeInTheDocument();
});

it("offers Break up only on teams that have not been drawn yet", async () => {
  load.mockResolvedValue(pairSession());
  dissolve.mockResolvedValue(pairSession({ players: [pairSession().players[1]] }));
  renderRunner();

  await screen.findByText("Needs a partner · 3");
  expect(screen.getAllByRole("button", { name: /Break up/ })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Break up Ali / Bea" }));

  await waitFor(() => expect(dissolve).toHaveBeenCalledWith("f1", "t-Ali / Bea"));
  await waitFor(() => expect(screen.queryByRole("button", { name: /Break up/ })).not.toBeInTheDocument());
});

// ── team names (Mexicano and Roulette) ──

const nameField = () => screen.getByRole("textbox", { name: "Team name (optional)" });

it("names a new team as it's made, then clears the name for the next one", async () => {
  load.mockResolvedValue(pairSession());
  create.mockResolvedValue(afterPairing());
  renderRunner();

  await screen.findByText("Needs a partner · 3");
  fireEvent.change(nameField(), { target: { value: "Sand Sharks" } });
  fireEvent.click(within(pool()).getByRole("button", { name: "Eve" }));
  fireEvent.click(within(pool()).getByRole("button", { name: "Fay" }));

  expect(create).toHaveBeenCalledWith("f1", ["m5", "m6"], "Sand Sharks");
  expect(nameField()).toHaveValue("");
  await screen.findByRole("button", { name: "Undo Eve / Fay" });
});

it("puts the typed name back when the team couldn't be made", async () => {
  load.mockResolvedValue(pairSession());
  create.mockRejectedValue({ response: { data: { message: "Team names can be at most 100 characters." } } });
  renderRunner();

  await screen.findByText("Needs a partner · 3");
  fireEvent.change(nameField(), { target: { value: "Sand Sharks" } });
  fireEvent.click(within(pool()).getByRole("button", { name: "Eve" }));
  fireEvent.click(within(pool()).getByRole("button", { name: "Fay" }));

  await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Team names can be at most 100 characters."));
  expect(nameField()).toHaveValue("Sand Sharks");
});

it("renames a team, also one that has played, and shows its players under the new name", async () => {
  load.mockResolvedValue(pairSession());
  (window.prompt as jest.Mock).mockReturnValue("  Net Ninjas ");
  rename.mockResolvedValue(
    pairSession({
      players: [pairSession().players[0], { ...pairSession().players[1], name: "Net Ninjas" }],
    })
  );
  renderRunner();

  await screen.findByText("Needs a partner · 3");
  expect(screen.getAllByRole("button", { name: /^Rename / })).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Rename Cy / Dee" }));

  expect(window.prompt).toHaveBeenCalledWith("New name for Cy / Dee", "Cy / Dee");
  await waitFor(() => expect(rename).toHaveBeenCalledWith("f1", "t-Cy / Dee", "Net Ninjas"));
  expect(await screen.findByText("Net Ninjas")).toBeInTheDocument();
  expect(screen.getByText("Cy, Dee")).toBeInTheDocument();
});

it("doesn't rename when the prompt is cancelled or the name is unchanged, and says why a rename was refused", async () => {
  load.mockResolvedValue(pairSession());
  renderRunner();
  await screen.findByText("Needs a partner · 3");

  (window.prompt as jest.Mock).mockReturnValueOnce(null).mockReturnValueOnce("Ali / Bea ");
  fireEvent.click(screen.getByRole("button", { name: "Rename Ali / Bea" }));
  fireEvent.click(screen.getByRole("button", { name: "Rename Ali / Bea" }));
  expect(rename).not.toHaveBeenCalled();

  rename.mockRejectedValue({ response: { data: { message: "Type a team name." } } });
  (window.prompt as jest.Mock).mockReturnValueOnce("");
  fireEvent.click(screen.getByRole("button", { name: "Rename Ali / Bea" }));
  await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Type a team name."));
});

it("has no team names or Rename for single-player stages or plain referees", async () => {
  load.mockResolvedValue(session());
  const singles = renderRunner();
  await screen.findByRole("heading", { name: "Men's Open" });
  expect(screen.queryByRole("textbox", { name: "Team name (optional)" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Rename / })).not.toBeInTheDocument();
  singles.unmount();

  load.mockResolvedValue(pairSession());
  renderRunner(false);
  await screen.findByRole("heading", { name: "Men's Open" });
  expect(screen.queryByRole("button", { name: /^Rename / })).not.toBeInTheDocument();
});

// ── Roulette ──

const roulette = (over: Partial<MexicanoSession> = {}) =>
  session({ blockType: "Roulette", unitsPerSide: 2, stageName: "Friday Roulette", plannedRounds: 0, ...over });

const rouletteRound = (over: Partial<MexicanoSession> = {}) =>
  roundOne({
    blockType: "Roulette",
    unitsPerSide: 2,
    stageName: "Friday Roulette",
    plannedRounds: 0,
    currentRoundRepeats: { lineUps: 0, matches: 0 },
    ...over,
  });

it("Roulette draws the next round, and an open-ended stage has no round count", async () => {
  load.mockResolvedValue(roulette({ canStartNextRound: true, nextRoundBlockedReason: null }));
  start.mockResolvedValue(rouletteRound());
  renderRunner();

  expect(await screen.findByText("Friday Roulette · Open-ended")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Back to Roulette" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Start round/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Round" }));
  expect(screen.getByText(/then press Draw next round/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Draw next round" }));

  expect(start).toHaveBeenCalledWith("f1");
  expect(await screen.findByText("Friday Roulette · Round 1")).toBeInTheDocument();
  expect(screen.getByText("Court 1")).toBeInTheDocument();
});

it("a Roulette round with planned rounds counts them", async () => {
  load.mockResolvedValue(rouletteRound({ plannedRounds: 6 }));
  renderRunner();

  expect(await screen.findByText("Friday Roulette · Round 1 of 6")).toBeInTheDocument();
});

it("Roulette courts list every unit of each side", async () => {
  const big = court("m1", "Court 1", {
    formatType: "Roulette",
    homeExtraUnits: [{ teamId: "t-Eve", teamName: "Eve" }],
    awayExtraUnits: [{ teamId: "t-Fay", teamName: "Fay" }],
  });
  load.mockResolvedValue(rouletteRound({ rounds: [{ number: 1, matches: [big], sittingOut: [] }] }));
  renderRunner();

  for (const name of ["Ali", "Dee", "Eve", "Bea", "Cy", "Fay"]) {
    expect(await screen.findByText(name, { selector: ".side-name__unit" })).toBeInTheDocument();
  }
});

it("notes repeated line-ups under the current round only", async () => {
  const roundTwo = { number: 2, matches: [court("m2", "Court 1", { round: "Round 2" })], sittingOut: [] };
  load.mockResolvedValue(
    rouletteRound({
      currentRound: 2,
      currentRoundRepeats: { lineUps: 2, matches: 0 },
      rounds: [{ number: 1, matches: [court("m1", "Court 1")], sittingOut: [] }, roundTwo],
    })
  );
  renderRunner();

  const note = "No fresh line-ups left for everyone here — 2 line-ups in this round were played before.";
  expect(await screen.findByText(note)).toBeInTheDocument();

  fireEvent.change(screen.getByRole("combobox", { name: "Round" }), { target: { value: "1" } });
  expect(screen.queryByText(note)).not.toBeInTheDocument();
});

it("a Mexicano round never shows the repeat note", async () => {
  load.mockResolvedValue(roundOne({ currentRoundRepeats: { lineUps: 0, matches: 0 } }));
  renderRunner();
  await screen.findByText("Court 1");

  expect(screen.queryByText(/No fresh line-ups/)).not.toBeInTheDocument();
});

it("an open-ended Roulette stage offers Finish, which says no more rounds are drawn", async () => {
  load.mockResolvedValue(rouletteRound({ canFinish: true }));
  finish.mockResolvedValue(rouletteRound({ ended: true, canUndoRound: false, canFinish: false }));
  renderRunner();
  await screen.findByText("Court 1");

  fireEvent.click(screen.getByRole("button", { name: "More actions" }));
  expect(screen.queryByRole("button", { name: "Finish early" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Finish" }));

  expect((window.confirm as jest.Mock).mock.calls[0][0]).toMatch(/No more rounds can be drawn/);
  await waitFor(() => expect(finish).toHaveBeenCalledWith("f1"));
});

it("forms named teams for a Roulette stage of pairs too", async () => {
  load.mockResolvedValue(pairSession({ blockType: "Roulette", plannedRounds: 0 }));
  renderRunner();

  expect(await screen.findByText("Needs a partner · 3")).toBeInTheDocument();
  expect(nameField()).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Rename Ali / Bea" })).toBeInTheDocument();
});
