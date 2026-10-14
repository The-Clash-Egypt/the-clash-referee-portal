import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "../../../ui/Toast";
import MexicanoStageCards from "./MexicanoStageCards";
import { getMexicanoSession } from "../api/mexicano";
import { getTournamentStages } from "../api/stages";
import { finishAmericano, getAmericanoMatches } from "../api/americano";
import { AmericanoMatch, TournamentStage } from "../types";

jest.mock("../../../api/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("../api/stages", () => ({ getTournamentStages: jest.fn() }));
jest.mock("../api/mexicano", () => ({
  ...jest.requireActual("../api/mexicano"),
  getMexicanoSession: jest.fn(),
}));
jest.mock("../api/americano", () => ({ getAmericanoMatches: jest.fn(), finishAmericano: jest.fn() }));

const stages = getTournamentStages as jest.Mock;
const load = getMexicanoSession as jest.Mock;
const schedule = getAmericanoMatches as jest.Mock;
const finish = finishAmericano as jest.Mock;

const mexicano = (formatId: string, categoryName: string, stageName = "Mexicano"): TournamentStage => ({
  kind: "Mexicano",
  formatId,
  categoryName,
  stageName,
  isEnded: null,
});
const americano = (formatId: string, categoryName: string, isEnded: boolean | null = false): TournamentStage => ({
  kind: "Americano",
  formatId,
  categoryName,
  stageName: "Americano",
  isEnded,
});

let nextId = 0;
const match = (round: number, state: "done" | "open"): AmericanoMatch => ({
  id: `x${++nextId}`,
  round: `Round ${round}`,
  isCompleted: state === "done",
  gameScores: state === "done" ? [{ gameNumber: 1, homeScore: 9, awayScore: 7 }] : [],
});
/** Rounds 1-2 played, round 3 one court in of two, round 4 not started. */
const halfway = [
  match(1, "done"),
  match(1, "done"),
  match(2, "done"),
  match(2, "done"),
  match(3, "done"),
  match(3, "open"),
  match(4, "open"),
  match(4, "open"),
];

function renderCards(props: Partial<React.ComponentProps<typeof MexicanoStageCards>> = {}, { toasts = false } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onOpen = jest.fn();
  const cards = <MexicanoStageCards tournamentId="t1" onOpen={onOpen} {...props} />;
  const view = render(
    <QueryClientProvider client={client}>{toasts ? <ToastProvider>{cards}</ToastProvider> : cards}</QueryClientProvider>
  );
  return { ...view, client, onOpen };
}

beforeEach(() => {
  jest.resetAllMocks();
  window.confirm = jest.fn(() => true);
});

it("shows a card per Mexicano stage with where it stands, and opens it on tap", async () => {
  stages.mockResolvedValue([mexicano("m1", "Men's Open", "Evening"), mexicano("m2", "Mixed")]);
  load.mockImplementation((formatId: string) =>
    formatId === "m1"
      ? Promise.resolve({ currentRound: 3, plannedRounds: 8, currentRoundScored: 4, currentRoundTotal: 4, ended: false })
      : Promise.reject(new Error("Network Error"))
  );

  const { onOpen } = renderCards();

  expect(await screen.findByText("Men's Open")).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Mexicano stages" })).toBeInTheDocument();
  const evening = screen.getByRole("button", { name: /Men's Open/ });
  expect(within(evening).getByText("Evening")).toBeInTheDocument();
  expect(await within(evening).findByText("Round 3 of 8")).toBeInTheDocument();
  expect(within(evening).getByText("Ready for next round")).toBeInTheDocument();
  // Its session didn't load: still reachable. The default stage name says nothing on the Mexicano tab.
  const mixed = screen.getByRole("button", { name: /Mixed/ });
  expect(within(mixed).getByText("Tap to open")).toBeInTheDocument();
  expect(within(mixed).queryByText("Mexicano")).not.toBeInTheDocument();
  fireEvent.click(mixed);
  expect(onOpen).toHaveBeenCalledWith("m2");
  expect(stages).toHaveBeenCalledWith("t1");
  expect(schedule).not.toHaveBeenCalled();
});

it("renders nothing for a tournament without an Americano or Mexicano stage", async () => {
  stages.mockResolvedValue([]);

  const { container } = renderCards();
  await waitFor(() => expect(stages).toHaveBeenCalledWith("t1"));

  expect(container).toBeEmptyDOMElement();
  expect(load).not.toHaveBeenCalled();
});

it("shows the loading placeholder it is given until the stages are in", async () => {
  let answer: (value: unknown[]) => void = () => {};
  stages.mockReturnValue(new Promise((resolve) => (answer = resolve)));

  const { container } = renderCards({ loading: <p>Loading stages...</p> });
  expect(screen.getByText("Loading stages...")).toBeInTheDocument();

  answer([]);
  await waitFor(() => expect(container).toBeEmptyDOMElement());
});

it("shows the empty state it is given for a tournament without a stage", async () => {
  stages.mockResolvedValue([]);

  renderCards({ empty: <p>No stages</p> });

  expect(await screen.findByText("No stages")).toBeInTheDocument();
});

it("shows the error state it is given when the stages can't load, and Try again asks again", async () => {
  stages.mockRejectedValueOnce(new Error("Network Error")).mockResolvedValueOnce([mexicano("m1", "Men's Open")]);
  load.mockResolvedValue(null);

  renderCards({ empty: <p>No stages</p>, failed: (retry) => <button onClick={retry}>Try again</button> });

  fireEvent.click(await screen.findByRole("button", { name: "Try again" }));

  expect(await screen.findByText("Men's Open")).toBeInTheDocument();
  expect(stages).toHaveBeenCalledTimes(2);
  expect(screen.queryByText("No stages")).not.toBeInTheDocument();
});

it("shows Americano stages next to Mexicano ones: where each stands, and not as links", async () => {
  stages.mockResolvedValue([
    mexicano("m1", "Men's Open"),
    americano("a1", "Mixed"),
    americano("a2", "Women's Open", true),
    americano("a3", "Juniors"),
  ]);
  load.mockResolvedValue({ currentRound: 0, plannedRounds: 6, currentRoundScored: 0, currentRoundTotal: 0, ended: false });
  schedule.mockImplementation((formatId: string) =>
    Promise.resolve(formatId === "a1" ? halfway : formatId === "a2" ? [match(1, "done")] : [])
  );

  const { onOpen } = renderCards();

  expect(await screen.findByRole("region", { name: "Stages" })).toBeInTheDocument();
  // Next to Americano stages, a Mexicano stage's default name says which kind it is.
  expect(within(screen.getByRole("button", { name: /Men's Open/ })).getByText("Mexicano")).toBeInTheDocument();

  const mixed = screen.getByRole("article", { name: "Mixed · Americano" });
  expect(within(mixed).getByText("Americano")).toBeInTheDocument();
  expect(await within(mixed).findByText("Round 3 of 4 · 1/2 scored")).toBeInTheDocument();
  expect(await within(screen.getByRole("article", { name: /Women's Open/ })).findByText("Finished")).toBeInTheDocument();
  expect(await within(screen.getByRole("article", { name: /Juniors/ })).findByText("No schedule yet")).toBeInTheDocument();

  // No runner to open, and no Finish early without the organizer's roles.
  expect(within(mixed).queryByRole("button")).not.toBeInTheDocument();
  fireEvent.click(mixed);
  expect(onOpen).not.toHaveBeenCalled();
  expect(schedule).toHaveBeenCalledWith("a1");
});

it("offers Finish early to organizers only once a score is in, and not after the stage is over", async () => {
  stages.mockResolvedValue([americano("a1", "Mixed"), americano("a2", "Juniors"), americano("a3", "Women's Open", true)]);
  schedule.mockImplementation((formatId: string) =>
    Promise.resolve(formatId === "a1" ? halfway : formatId === "a2" ? [match(1, "open"), match(2, "open")] : halfway)
  );

  renderCards({ canRun: true });

  const mixed = await screen.findByRole("article", { name: /Mixed/ });
  expect(await within(mixed).findByRole("button", { name: "Finish early" })).toBeEnabled();
  expect(screen.getByRole("region", { name: "Americano stages" })).toBeInTheDocument();
  await within(screen.getByRole("article", { name: /Juniors/ })).findByText("Round 1 of 2 · 0/1 scored");
  expect(within(screen.getByRole("article", { name: /Juniors/ })).queryByRole("button")).not.toBeInTheDocument();
  expect(within(screen.getByRole("article", { name: /Women's Open/ })).queryByRole("button")).not.toBeInTheDocument();
});

it("finishes an Americano stage early after asking, then shows it finished and refreshes the matches", async () => {
  stages.mockResolvedValueOnce([americano("a1", "Mixed")]).mockResolvedValue([americano("a1", "Mixed", true)]);
  schedule.mockResolvedValueOnce(halfway).mockResolvedValue(halfway.filter((m) => m.isCompleted));
  let done: (value: unknown) => void = () => {};
  finish.mockReturnValue(new Promise((resolve) => (done = resolve)));

  const { client } = renderCards({ canRun: true }, { toasts: true });
  const invalidate = jest.spyOn(client, "invalidateQueries");

  // Declining asks nothing of the server.
  (window.confirm as jest.Mock).mockReturnValueOnce(false);
  fireEvent.click(await screen.findByRole("button", { name: "Finish early" }));
  expect(window.confirm).toHaveBeenCalledWith(
    "Finish after 3 rounds? 3 unplayed matches will be removed and the leaderboard becomes final. This can't be undone."
  );
  expect(finish).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Finish early" }));
  expect(finish).toHaveBeenCalledWith("a1");
  expect(await screen.findByRole("button", { name: "Finishing..." })).toBeDisabled();

  done({ roundsPlayed: 3, matchesRemoved: 3 });

  expect(await screen.findByText("Finished after 3 rounds — 3 unplayed matches removed.")).toBeInTheDocument();
  const card = screen.getByRole("article", { name: /Mixed/ });
  expect(await within(card).findByText("Finished")).toBeInTheDocument();
  expect(within(card).queryByRole("button")).not.toBeInTheDocument();
  expect(schedule).toHaveBeenCalledTimes(2);
  expect(stages).toHaveBeenCalledTimes(2);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["referee-matches"] });
});

it("shows the server's reason when it refuses to finish, and keeps the button", async () => {
  stages.mockResolvedValue([americano("a1", "Mixed")]);
  schedule.mockResolvedValue(halfway);
  finish.mockRejectedValue({
    response: { data: { message: "Round 3 · Court 2 is still in progress — finish or clear its score first." } },
  });

  renderCards({ canRun: true }, { toasts: true });

  fireEvent.click(await screen.findByRole("button", { name: "Finish early" }));

  // The toasts' live regions are always on the page; an error shows in the urgent one.
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Round 3 · Court 2 is still in progress — finish or clear its score first."
    )
  );
  expect(await screen.findByRole("button", { name: "Finish early" })).toBeEnabled();
  expect(screen.queryByText("Finished")).not.toBeInTheDocument();
});

it("falls back to its own message when the server gives no reason", async () => {
  stages.mockResolvedValue([americano("a1", "Mixed")]);
  schedule.mockResolvedValue(halfway);
  finish.mockRejectedValue(new Error("Network Error"));

  renderCards({ canRun: true }, { toasts: true });

  fireEvent.click(await screen.findByRole("button", { name: "Finish early" }));

  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Couldn't finish the event."));
});

it("a Roulette stage opens its runner like a Mexicano one, and its default name says nothing on the Roulette tab", async () => {
  stages.mockResolvedValue([{ kind: "Roulette", formatId: "r1", categoryName: "Open", stageName: "Roulette", isEnded: null }]);
  load.mockResolvedValue({ currentRound: 2, plannedRounds: 6, currentRoundScored: 1, currentRoundTotal: 2, ended: false });

  const { onOpen } = renderCards();

  expect(await screen.findByRole("region", { name: "Roulette stages" })).toBeInTheDocument();
  const card = screen.getByRole("button", { name: /Open/ });
  expect(await within(card).findByText("Round 2 of 6")).toBeInTheDocument();
  expect(within(card).queryByText("Roulette")).not.toBeInTheDocument();
  fireEvent.click(card);
  expect(onOpen).toHaveBeenCalledWith("r1");
  expect(load).toHaveBeenCalledWith("r1");
  expect(schedule).not.toHaveBeenCalled();
});

it("names a Roulette stage's default name next to stages of another kind", async () => {
  stages.mockResolvedValue([
    { kind: "Roulette", formatId: "r1", categoryName: "Open", stageName: "Roulette", isEnded: null },
    mexicano("m1", "Mixed"),
  ]);
  load.mockResolvedValue({ currentRound: 0, plannedRounds: 6, currentRoundScored: 0, currentRoundTotal: 0, ended: false });

  renderCards();

  expect(await screen.findByRole("region", { name: "Stages" })).toBeInTheDocument();
  expect(within(screen.getByRole("button", { name: /Open/ })).getByText("Roulette")).toBeInTheDocument();
});
