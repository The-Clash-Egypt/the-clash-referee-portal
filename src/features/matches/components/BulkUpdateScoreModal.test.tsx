import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import BulkUpdateScoreModal, { BulkScoreEntry, BulkScoreResult } from "./BulkUpdateScoreModal";
import { Match } from "../types/match";

const match = (id: string, home: string, away: string, over: Partial<Match> = {}): Match =>
  ({
    id,
    homeTeamName: home,
    awayTeamName: away,
    venue: "Court 1",
    startTime: "2026-09-12T08:00:00Z",
    round: "Round 1",
    formatType: "Group",
    bestOf: 3,
    isCompleted: false,
    ...over,
  }) as Match;

const falcons = match("m1", "Falcons", "Sharks");
const eagles = match("m2", "Eagles", "Tigers");
const americano = match("m3", "Aly", "Karim", { venue: "Court 2", formatType: "Americano", bestOf: 1, pointsPerMatch: 21 });

const allSucceed = (entries: BulkScoreEntry[]): Promise<BulkScoreResult[]> =>
  Promise.resolve(entries.map((entry) => ({ matchId: entry.match.id, ok: true })));

const setup = (onSaveImpl = allSucceed, matches: Match[] = [falcons, eagles, americano]) => {
  const onSave = jest.fn(onSaveImpl);
  const onClose = jest.fn();
  const onRemoveMatch = jest.fn();
  const utils = render(
    <BulkUpdateScoreModal isOpen selectedMatches={matches} onSave={onSave} onClose={onClose} onRemoveMatch={onRemoveMatch} />
  );
  return { ...utils, onSave, onClose, onRemoveMatch };
};

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

afterEach(() => jest.restoreAllMocks());

it("shows every ticked match on one screen, grouped by court", () => {
  setup();

  expect(screen.getByRole("heading", { name: "Court 1" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Court 2" })).toBeInTheDocument();
  expect(screen.getByLabelText("Falcons game 1")).toBeInTheDocument();
  expect(screen.getByLabelText("Aly game 1")).toBeInTheDocument();
});

it("tabs through a scoresheet in game pairs", () => {
  setup();

  const labels = screen.getAllByRole("textbox").slice(0, 4).map((input) => input.getAttribute("aria-label"));
  expect(labels).toEqual(["Falcons game 1", "Sharks game 1", "Falcons game 2", "Sharks game 2"]);
});

it("saves nothing while any changed row has errors", () => {
  const { onSave } = setup();

  type("Falcons game 1", "21");
  type("Sharks game 1", "21");
  fireEvent.click(screen.getByRole("button", { name: "Save 1 match" }));

  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("1 match has errors.");
  expect(screen.getByText("Game 1 cannot end in a tie.")).toBeInTheDocument();
});

it("saves only the valid rows when the user explicitly skips the rest", async () => {
  const { onSave, onClose } = setup();

  type("Falcons game 1", "21");
  type("Sharks game 1", "21");
  type("Eagles game 1", "21");
  type("Tigers game 1", "15");
  fireEvent.click(screen.getByRole("button", { name: "Save 2 matches" }));
  fireEvent.click(screen.getByRole("button", { name: "Save 1 valid, skip 1" }));

  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(onSave.mock.calls[0][0]).toEqual([{ match: eagles, gameScores: [{ gameNumber: 1, homeScore: 21, awayScore: 15 }] }]);
  expect(await screen.findByText("Saved ✓")).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled(); // the skipped row is still waiting
});

it("sends only changed rows and closes once everything saved", async () => {
  const { onSave, onClose } = setup();

  type("Eagles game 1", "21");
  type("Tigers game 1", "15");
  fireEvent.click(screen.getByRole("button", { name: "Save 1 match" }));

  await waitFor(() => expect(onClose).toHaveBeenCalledWith(["m2"]));
  expect(onSave.mock.calls[0][0]).toHaveLength(1);
});

it("keeps a failed row editable and locks the saved one", async () => {
  const { onClose } = setup(async () => [
    { matchId: "m1", ok: true },
    { matchId: "m2", ok: false, error: "Venue conflict at 10:30" },
  ]);

  type("Falcons game 1", "21");
  type("Sharks game 1", "17");
  type("Eagles game 1", "21");
  type("Tigers game 1", "15");
  fireEvent.click(screen.getByRole("button", { name: "Save 2 matches" }));

  expect(await screen.findByText("Venue conflict at 10:30")).toBeInTheDocument();
  expect(screen.getByText("Saved ✓")).toBeInTheDocument();
  expect(screen.getByLabelText("Falcons game 1")).toBeDisabled();
  expect(screen.getByLabelText("Eagles game 1")).toBeEnabled();
  expect(onClose).not.toHaveBeenCalled();
});

it("checks an Americano total", () => {
  const { onSave } = setup();

  type("Aly game 1", "12");
  type("Karim game 1", "8");
  fireEvent.click(screen.getByRole("button", { name: "Save 1 match" }));

  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getByText("Total points must equal 21 (currently 20).")).toBeInTheDocument();
});

it("removes a mistakenly ticked match", () => {
  const { onRemoveMatch } = setup();

  fireEvent.click(screen.getByRole("button", { name: "Remove Falcons vs Sharks from this list" }));

  expect(onRemoveMatch).toHaveBeenCalledWith("m1");
});

it("keeps what was typed when the selection changes", () => {
  const { rerender, onSave, onClose, onRemoveMatch } = setup();

  type("Falcons game 1", "21");
  rerender(
    <BulkUpdateScoreModal isOpen selectedMatches={[falcons, eagles]} onSave={onSave} onClose={onClose} onRemoveMatch={onRemoveMatch} />
  );

  expect(screen.getByLabelText("Falcons game 1")).toHaveValue("21");
});

it("asks before throwing typed scores away", () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  const { onClose } = setup();

  type("Falcons game 1", "21");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(confirm).toHaveBeenCalledWith("Discard the scores you've entered?");
  expect(onClose).not.toHaveBeenCalled();
});
