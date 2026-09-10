import React, { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import UpdateScoreDialog from "./UpdateScoreDialog";
import { updateLiveScore } from "../api/matches";
import { Match, MatchGameScore } from "../types/match";

jest.mock("../../../api/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("../api/matches", () => ({
  ...jest.requireActual("../api/matches"),
  updateLiveScore: jest.fn(),
}));

// jsdom's default 1024×768 viewport counts as a phone to this dialog, so `openInFullscreen`
// opens the fullscreen scoreboard exactly as it does on the guest pages.

const liveScore = updateLiveScore as jest.Mock;

const MATCH_A = "0b6f1c9e-2d4a-4e8b-9c3f-5a7d1e2f3a4b";
const MATCH_B = "7c2e9a4d-1b3f-4d6e-8a5c-9e0f1a2b3c4d";

const match = (over: Partial<Match> = {}): Match =>
  ({
    id: MATCH_A,
    homeTeamName: "Falcons",
    awayTeamName: "Sharks",
    formatType: "Group",
    bestOf: 3,
    pointsForDraw: null,
    gameScores: [],
    isCompleted: false,
    ...over,
  }) as Match;

const game = (gameNumber: number, homeScore: number, awayScore: number): MatchGameScore => ({
  gameNumber,
  homeScore,
  awayScore,
});

/**
 * Plays the page's part. Like GuestMatchView, a save replaces the match with the saved result
 * while the dialog is still open; like GuestVenuePage, closing clears the selection.
 */
const Page: React.FC<{ matches: Match[]; submit: jest.Mock }> = ({ matches, submit }) => {
  const [list, setList] = useState(matches);
  const [openId, setOpenId] = useState<string | null>(null);
  const selected = list.find((item) => item.id === openId) ?? null;

  const onSubmit = async (gameScores: MatchGameScore[]) => {
    submit(gameScores);
    setList((current) => current.map((item) => (item.id === openId ? { ...item, gameScores } : item)));
  };

  return (
    <>
      {list.map((item) => (
        <button key={item.id} onClick={() => setOpenId(item.id)}>
          Score {item.homeTeamName}
        </button>
      ))}
      <UpdateScoreDialog
        isOpen={selected !== null}
        match={selected}
        onClose={() => setOpenId(null)}
        onSubmit={onSubmit}
        loading={false}
        matchAccessToken="tok"
        openInFullscreen
      />
    </>
  );
};

const scoreboard = () =>
  // eslint-disable-next-line testing-library/no-node-access -- the big score digits have no accessible name
  Array.from(document.querySelectorAll(".fullscreen-scoreboard .score-display")).map((node) => node.textContent);
const addPoint = (side: "home" | "away") =>
  fireEvent.click(screen.getAllByRole("button", { name: "+" })[side === "home" ? 0 : 1]);
const pause = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

beforeEach(() => {
  liveScore.mockResolvedValue({ data: {} });
});

afterEach(() => jest.restoreAllMocks());

describe("fullscreen snapshot (back arrow keeps the score for the same match)", () => {
  it("restores the snapshot for the same match, but never over a game saved since", async () => {
    const submit = jest.fn();
    render(<Page matches={[match()]} submit={submit} />);

    fireEvent.click(screen.getByRole("button", { name: "Score Falcons" }));
    addPoint("home");
    addPoint("home");
    addPoint("away");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    // Re-opening the same match picks up where the back arrow left it.
    fireEvent.click(screen.getByRole("button", { name: "Score Falcons" }));
    expect(scoreboard()).toEqual(["2", "1"]);

    addPoint("home");
    fireEvent.click(screen.getByRole("button", { name: "Save Scores" }));
    liveScore.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Save Scores" })).not.toBeInTheDocument());
    expect(submit).toHaveBeenCalledWith([game(1, 3, 1)]);

    // Re-opening after the save shows the saved game, not the 2–1 snapshot from before it.
    fireEvent.click(screen.getByRole("button", { name: "Score Falcons" }));
    expect(scoreboard()).toEqual(["3", "1"]);

    await waitFor(() =>
      expect(liveScore).toHaveBeenLastCalledWith(
        { matchId: MATCH_A, gameScores: [game(1, 3, 1)] },
        { venueAccessToken: undefined, matchAccessToken: "tok" }
      )
    );
    expect(liveScore).not.toHaveBeenCalledWith(
      expect.objectContaining({ gameScores: [game(1, 2, 1)] }),
      expect.anything()
    );
  });

  it("never restores one match's snapshot into another match", async () => {
    render(
      <Page matches={[match(), match({ id: MATCH_B, homeTeamName: "Eagles", awayTeamName: "Rays" })]} submit={jest.fn()} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Score Falcons" }));
    addPoint("home");
    addPoint("home");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    liveScore.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Score Eagles" }));
    expect(scoreboard()).toEqual(["0", "0"]);

    await pause(700); // past the live-score debounce
    expect(liveScore).not.toHaveBeenCalledWith(expect.objectContaining({ matchId: MATCH_B }), expect.anything());
  });
});

describe("fullscreen save", () => {
  it("shows why a save was refused", () => {
    render(<Page matches={[match()]} submit={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Score Falcons" }));
    addPoint("home");
    addPoint("away");
    fireEvent.click(screen.getByRole("button", { name: "Save Scores" }));

    expect(screen.getByText("Game 1 cannot end in a tie.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
  });
});

describe("removing a set", () => {
  const renderDialog = (current: Match, onSubmit = jest.fn().mockResolvedValue(undefined), onClose = jest.fn()) => {
    render(<UpdateScoreDialog isOpen match={current} onClose={onClose} onSubmit={onSubmit} loading={false} />);
    return { onSubmit, onClose };
  };
  const setLabels = () => screen.getAllByText(/^Set \d+$/).map((node) => node.textContent);

  it("renumbers the remaining sets 1..n, so the save has no gaps", async () => {
    const { onSubmit, onClose } = renderDialog(
      match({ gameScores: [game(1, 21, 17), game(2, 18, 21), game(3, 15, 11)] })
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Remove set" })[1]);
    expect(setLabels()).toEqual(["Set 1", "Set 2"]);

    fireEvent.click(screen.getByRole("button", { name: "Save Scores" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(onSubmit).toHaveBeenCalledWith([game(1, 21, 17), game(2, 15, 11)]);
  });

  it("keeps the selected set in range", () => {
    renderDialog(match({ gameScores: [game(1, 21, 17), game(2, 18, 21)] }));

    fireEvent.click(screen.getByTitle("Enter fullscreen scoreboard"));
    fireEvent.click(screen.getByRole("button", { name: "Add Set 3" })); // selects the new set
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Remove set" })[2]);
    fireEvent.click(screen.getByTitle("Enter fullscreen scoreboard"));

    expect(screen.getByRole("button", { name: "Set 2" })).toHaveClass("active");
    expect(scoreboard()).toEqual(["18", "21"]);
  });
});

it("stays open with the typed scores when the save is rejected", async () => {
  const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  const onClose = jest.fn();
  const onSubmit = jest.fn().mockRejectedValue(new Error("refused"));
  render(<UpdateScoreDialog isOpen match={match()} onClose={onClose} onSubmit={onSubmit} loading={false} />);

  const [home, away] = screen.getAllByRole("spinbutton");
  fireEvent.change(home, { target: { value: "21" } });
  fireEvent.change(away, { target: { value: "17" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Scores" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument());

  expect(onSubmit).toHaveBeenCalledWith([game(1, 21, 17)]);
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getAllByRole("spinbutton").map((input) => (input as HTMLInputElement).value)).toEqual(["21", "17"]);
  expect(errorSpy).toHaveBeenCalledWith("Error updating scores:", expect.any(Error));
});
