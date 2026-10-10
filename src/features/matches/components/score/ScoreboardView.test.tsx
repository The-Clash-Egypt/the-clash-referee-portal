import React, { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Drawer, { DRAWER_EXIT_MS } from "../../../shared/components/Drawer";
import UpdateScoreDialog from "../UpdateScoreDialog";
import { updateLiveScore } from "../../api/matches";
import { Match, MatchGameScore } from "../../types/match";

jest.mock("../../../../api/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("../../api/matches", () => ({
  ...jest.requireActual("../../api/matches"),
  updateLiveScore: jest.fn(),
}));

const liveScore = updateLiveScore as jest.Mock;

const MATCH_ID = "e0000000-0000-4000-8000-000000000001";

const game = (gameNumber: number, homeScore: number, awayScore: number): MatchGameScore => ({
  gameNumber,
  homeScore,
  awayScore,
});

// The approved mockup's match: set 1 won 21–18, set 2 being played at 9–7.
const sandSharks = (over: Partial<Match> = {}): Match =>
  ({
    id: MATCH_ID,
    venue: "Court 1",
    round: "Round of 16",
    formatType: "Knockout",
    bestOf: 3,
    pointsForDraw: null,
    homeTeamName: "Sand Sharks",
    awayTeamName: "Blue Wave",
    gameScores: [game(1, 21, 18), game(2, 9, 7)],
    isCompleted: false,
    ...over,
  }) as Match;

const openScoreboard = (match: Match = sandSharks()) =>
  render(
    <UpdateScoreDialog
      isOpen
      match={match}
      onClose={jest.fn()}
      onSubmit={jest.fn()}
      loading={false}
      openInFullscreen={false}
    />
  );

/** jsdom has no matchMedia: report the viewport as portrait or landscape. */
const stubOrientation = (portrait: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query === "(orientation: portrait)" ? portrait : false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
};

const bigScores = () =>
  // eslint-disable-next-line testing-library/no-node-access -- the big score digits have no accessible name
  Array.from(document.querySelectorAll(".sb-team__score")).map((node) => node.textContent);

beforeEach(() => {
  liveScore.mockResolvedValue({ data: {} });
});

afterEach(() => {
  jest.useRealTimers();
  window.localStorage.clear();
  delete (window as unknown as Record<string, unknown>).matchMedia;
});

it("sends the live score once, with the point added to the set being played, after the debounce", async () => {
  jest.useFakeTimers();
  openScoreboard();

  fireEvent.click(screen.getByRole("button", { name: "Add point to Sand Sharks" }));
  expect(liveScore).not.toHaveBeenCalled();
  await act(async () => {
    jest.advanceTimersByTime(500);
  });

  expect(liveScore).toHaveBeenCalledTimes(1);
  expect(liveScore).toHaveBeenCalledWith(
    { matchId: MATCH_ID, gameScores: [game(1, 21, 18), game(2, 10, 7)] },
    { venueAccessToken: undefined, matchAccessToken: undefined }
  );
});

it("still shows both scores next to a 40-character team name", () => {
  openScoreboard(sandSharks({ homeTeamName: "New Cairo Beach Volleyball Academy Elite" }));

  expect(screen.getByText("New Cairo Beach Volleyball Academy Elite")).toBeInTheDocument();
  expect(bigScores()).toEqual(["9", "7"]);
  expect(screen.getByRole("button", { name: "Add point to New Cairo Beach Volleyball Academy Elite" })).toBeEnabled();
});

it("turns sideways in a portrait viewport when Landscape is pressed, and back with Upright", () => {
  stubOrientation(true);
  openScoreboard();
  const board = screen.getByRole("dialog", { name: "Scoreboard" });
  expect(board).not.toHaveClass("is-rotated");

  fireEvent.click(screen.getByRole("button", { name: "Landscape" }));
  expect(board).toHaveClass("is-rotated");

  fireEvent.click(screen.getByRole("button", { name: "Upright" }));
  expect(board).not.toHaveClass("is-rotated");
});

it("says whether the latest live score was saved", async () => {
  jest.useFakeTimers();
  const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  openScoreboard();
  expect(screen.queryByText("Live score saved")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Add point to Blue Wave" }));
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
  expect(screen.getByText("Live score saved")).toBeInTheDocument();

  liveScore.mockRejectedValueOnce(new Error("offline"));
  fireEvent.click(screen.getByRole("button", { name: "Add point to Blue Wave" }));
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
  expect(screen.getByText("Couldn't save the live score")).toBeInTheDocument();
  expect(screen.queryByText("Live score saved")).not.toBeInTheDocument();
  errorSpy.mockRestore();
});

// Review part 2, M2: "saved" is only ever about the score on the board.
it("doesn't say saved while a newer point is still on its way", async () => {
  jest.useFakeTimers();
  openScoreboard();

  fireEvent.click(screen.getByRole("button", { name: "Add point to Blue Wave" }));
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
  expect(screen.getByText("Live score saved")).toBeInTheDocument();

  // The next point: not saved yet (the debounce, then the call).
  let answer: (value: unknown) => void = () => undefined;
  liveScore.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
  fireEvent.click(screen.getByRole("button", { name: "Add point to Blue Wave" }));
  expect(screen.queryByText("Live score saved")).not.toBeInTheDocument();
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
  expect(screen.queryByText("Live score saved")).not.toBeInTheDocument(); // the call hasn't answered

  await act(async () => {
    answer({ data: {} });
  });
  expect(screen.getByText("Live score saved")).toBeInTheDocument();
});

describe("on the board", () => {
  const sides = () => screen.getAllByRole("region").map((side) => side.getAttribute("aria-label"));
  const scoreOf = (team: string) =>
    // eslint-disable-next-line testing-library/no-node-access -- the big score digits have no accessible name
    screen.getByRole("region", { name: team }).querySelector(".sb-team__score")?.textContent;

  it("reminds to switch sides every 7 points of the set; Done hides it until the next 7", () => {
    openScoreboard(sandSharks({ gameScores: [game(1, 21, 18), game(2, 3, 3)] }));
    expect(screen.queryByText(/Switch sides:/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add point to Sand Sharks" }));
    expect(screen.getByText("Switch sides: 7 points played")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByText(/Switch sides:/)).not.toBeInTheDocument();

    for (let point = 0; point < 6; point += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Add point to Blue Wave" }));
    }
    expect(screen.queryByText(/Switch sides:/)).not.toBeInTheDocument(); // 13
    fireEvent.click(screen.getByRole("button", { name: "Add point to Blue Wave" }));
    expect(screen.getByText("Switch sides: 14 points played")).toBeInTheDocument();
  });

  it("tags a side with the sets it has won", () => {
    openScoreboard();

    expect(screen.getByRole("region", { name: "Sand Sharks" })).toHaveTextContent("Won set 1");
    expect(screen.getByRole("region", { name: "Blue Wave" })).not.toHaveTextContent(/Won set/);
  });

  it("still scores each team by its name once the sides are switched", () => {
    openScoreboard();
    expect(sides()).toEqual(["Sand Sharks", "Blue Wave"]);

    fireEvent.click(screen.getByRole("button", { name: "Switch sides" }));
    expect(sides()).toEqual(["Blue Wave", "Sand Sharks"]);

    fireEvent.click(screen.getByRole("button", { name: "Add point to Sand Sharks" }));
    expect(scoreOf("Sand Sharks")).toBe("10");
    expect(scoreOf("Blue Wave")).toBe("7");
    fireEvent.click(screen.getByRole("button", { name: "Add point to Blue Wave" }));
    expect(scoreOf("Blue Wave")).toBe("8");
  });

  it("leaves with Escape, as with the back arrow", () => {
    const onClose = jest.fn();
    render(<UpdateScoreDialog isOpen match={sandSharks()} onClose={onClose} onSubmit={jest.fn()} loading={false} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Review part 2, M1: the teams are still on the ends they changed to.
  it("keeps the side swap when a scorer goes back and reopens the match; another match starts unswapped", () => {
    const other = sandSharks({ id: "e0000000-0000-4000-8000-000000000002", homeTeamName: "Dune Dogs", awayTeamName: "Salty Six" });
    const dialog = (isOpen: boolean, match: Match) => (
      <UpdateScoreDialog isOpen={isOpen} match={match} onClose={jest.fn()} onSubmit={jest.fn()} loading={false} />
    );
    const { rerender } = render(dialog(true, sandSharks()));

    fireEvent.click(screen.getByRole("button", { name: "Switch sides" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    rerender(dialog(false, sandSharks()));
    rerender(dialog(true, sandSharks()));
    expect(sides()).toEqual(["Blue Wave", "Sand Sharks"]);

    rerender(dialog(false, sandSharks()));
    rerender(dialog(true, other));
    expect(sides()).toEqual(["Dune Dogs", "Salty Six"]);
  });
});

it("keeps the page still while open, and scrollable once it closes, when it opens as the match sheet slides out", async () => {
  jest.useFakeTimers();
  const match = sandSharks();
  // MatchesPage: Score in the match sheet closes the sheet and opens the scoreboard at the same moment.
  const Page: React.FC = () => {
    const [sheetOpen, setSheetOpen] = useState(true);
    const [scoring, setScoring] = useState(false);
    return (
      <>
        <Drawer isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title="Sand Sharks v Blue Wave">
          <button
            onClick={() => {
              setSheetOpen(false);
              setScoring(true);
            }}
          >
            Score
          </button>
        </Drawer>
        <UpdateScoreDialog
          isOpen={scoring}
          match={scoring ? match : null}
          onClose={() => setScoring(false)}
          onSubmit={jest.fn()}
          loading={false}
        />
      </>
    );
  };
  render(<Page />);

  fireEvent.click(screen.getByRole("button", { name: "Score" }));
  await act(async () => {
    jest.advanceTimersByTime(DRAWER_EXIT_MS + 100); // the match sheet has slid out and unmounted
  });
  expect(screen.getByRole("dialog", { name: "Scoreboard" })).toBeInTheDocument();
  expect(document.body.style.overflow).toBe("hidden");

  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(document.body.style.overflow).toBe("");
});

// Review C1: the board and the sheets share one page lock, so neither lets the page scroll while the other is up.
describe("with a sheet open under it", () => {
  const Page: React.FC<{ sheet: boolean; board: boolean }> = ({ sheet, board }) => (
    <>
      <Drawer isOpen={sheet} onClose={jest.fn()} title="Filters">
        x
      </Drawer>
      <UpdateScoreDialog isOpen={board} match={board ? sandSharks() : null} onClose={jest.fn()} onSubmit={jest.fn()} loading={false} />
    </>
  );
  const slideOut = () =>
    act(() => {
      jest.advanceTimersByTime(DRAWER_EXIT_MS);
    });

  it("keeps the page still until both are closed: the board first", () => {
    jest.useFakeTimers();
    const { rerender } = render(<Page sheet board />);
    expect(screen.getByRole("dialog", { name: "Scoreboard" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    rerender(<Page sheet board={false} />);
    expect(screen.queryByRole("dialog", { name: "Scoreboard" })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden"); // the sheet still holds it

    rerender(<Page sheet={false} board={false} />);
    slideOut();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps the page still until both are closed: the sheet first", () => {
    jest.useFakeTimers();
    const { rerender } = render(<Page sheet board />);

    rerender(<Page sheet={false} board />);
    slideOut();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(document.body.style.overflow).toBe("hidden"); // the board still holds it

    rerender(<Page sheet={false} board={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });
});
