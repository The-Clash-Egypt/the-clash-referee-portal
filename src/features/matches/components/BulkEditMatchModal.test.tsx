import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import BulkEditMatchModal from "./BulkEditMatchModal";
import { DRAWER_EXIT_MS } from "../../shared/components/Drawer";
import { Match } from "../types/match";
import type { BulkEditResult, BulkMatchEdit } from "../hooks/useMatchActions";

afterEach(() => jest.useRealTimers());

const matches: Match[] = [
  { id: "m1", homeTeamName: "Falcons", awayTeamName: "Sharks", isCompleted: false },
  { id: "m2", homeTeamName: "Eagles", awayTeamName: "Tigers", isCompleted: false },
];

it("opens as a drawer and slides away once closed", () => {
  jest.useFakeTimers();
  const props = { onClose: jest.fn(), onSubmit: jest.fn(), loading: false };
  const { rerender } = render(<BulkEditMatchModal isOpen selectedMatches={matches} {...props} />);

  expect(screen.getByRole("dialog", { name: "Bulk Edit Matches" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Update 2 Matches" })).toBeInTheDocument();

  // After saving, the page clears the selection as it closes the drawer.
  rerender(<BulkEditMatchModal isOpen={false} selectedMatches={[]} {...props} />);
  act(() => {
    jest.advanceTimersByTime(DRAWER_EXIT_MS);
  });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

describe("start time", () => {
  // Local wall-clock times, so the tests read the same in every time zone.
  const at = (hours: number, minutes = 0) => new Date(2026, 9, 12, hours, minutes).toISOString();
  const timed: Match[] = [
    { id: "m1", homeTeamName: "Falcons", awayTeamName: "Sharks", venue: "Court 1", startTime: at(10), isCompleted: false },
    { id: "m2", homeTeamName: "Eagles", awayTeamName: "Tigers", venue: "Court 1", startTime: at(10, 30), isCompleted: false },
  ];
  const untimed: Match = { id: "m3", homeTeamName: "Lions", awayTeamName: "Bears", isCompleted: false };

  const allSaved = (updates: BulkMatchEdit[]): Promise<BulkEditResult[]> =>
    Promise.resolve(updates.map(({ matchId }) => ({ matchId, ok: true })));

  const setup = (selectedMatches: Match[] = timed, onSubmitImpl = allSaved) => {
    const onSubmit = jest.fn(onSubmitImpl);
    const onRemoveMatch = jest.fn();
    const utils = render(
      <BulkEditMatchModal
        isOpen
        selectedMatches={selectedMatches}
        onClose={jest.fn()}
        onSubmit={onSubmit}
        onRemoveMatch={onRemoveMatch}
        loading={false}
      />
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Update Start Time" }));
    return { ...utils, onSubmit, onRemoveMatch };
  };
  const save = (count = 2) => fireEvent.click(screen.getByRole("button", { name: `Update ${count} Matches` }));
  const minutes = () => screen.getByLabelText("Shift by (minutes)");

  it("shifts by a quick chip, previews before → after and sends each match's new time", async () => {
    const { onSubmit } = setup();

    expect(screen.getByRole("tab", { name: "Shift by" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("button", { name: "Shift by +30 minutes" }));

    expect(screen.getByRole("button", { name: "Shift by +30 minutes" })).toHaveAttribute("aria-pressed", "true");
    expect(minutes()).toHaveValue("+30");
    expect(screen.getByText("2 matches: 10:00–10:30 → 10:30–11:00")).toBeInTheDocument();

    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith([
      { matchId: "m1", startTime: at(10, 30) },
      { matchId: "m2", startTime: at(11) },
    ]);
  });

  it("steps by 5 minutes either way, and takes typed minutes", () => {
    setup();

    fireEvent.click(screen.getByRole("button", { name: "5 minutes later" }));
    fireEvent.click(screen.getByRole("button", { name: "5 minutes later" }));
    expect(minutes()).toHaveValue("+10");

    fireEvent.click(screen.getByRole("button", { name: "5 minutes earlier" }));
    fireEvent.click(screen.getByRole("button", { name: "5 minutes earlier" }));
    fireEvent.click(screen.getByRole("button", { name: "5 minutes earlier" }));
    expect(minutes()).toHaveValue("-5");
    expect(screen.getByText("2 matches: 10:00–10:30 → 09:55–10:25")).toBeInTheDocument();

    fireEvent.change(minutes(), { target: { value: "-20" } });
    expect(screen.getByText("2 matches: 10:00–10:30 → 09:40–10:10")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Shift by -15 minutes" }));
    expect(minutes()).toHaveValue("-15");
  });

  it("won't shift by 0 minutes (or by something that isn't minutes)", () => {
    const { onSubmit } = setup();

    expect(minutes()).toHaveValue("0");
    save();
    expect(screen.getByText("Choose how many minutes to shift by")).toBeInTheDocument();

    fireEvent.change(minutes(), { target: { value: "1.5" } });
    save();
    expect(screen.getByText("Shift by a whole number of minutes")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("leaves matches without a time as they are, and says so", async () => {
    const { onSubmit } = setup([...timed, untimed]);

    expect(screen.getByText("1 match has no time and stays as it is")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Shift by +15 minutes" }));
    expect(screen.getByText("2 matches: 10:00–10:30 → 10:15–10:45")).toBeInTheDocument();

    // Time only: the match without one isn't sent at all; with a court too, it gets just the court.
    save(3);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenLastCalledWith([
      { matchId: "m1", startTime: at(10, 15) },
      { matchId: "m2", startTime: at(10, 45) },
    ]);

    fireEvent.click(screen.getByRole("checkbox", { name: "Update Venue" }));
    fireEvent.change(screen.getByLabelText("Venue"), { target: { value: "Court 4" } });
    save(3);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit).toHaveBeenLastCalledWith([
      { matchId: "m1", venue: "Court 4", startTime: at(10, 15) },
      { matchId: "m2", venue: "Court 4", startTime: at(10, 45) },
      { matchId: "m3", venue: "Court 4" },
    ]);
  });

  it("with no times at all there's nothing to shift", () => {
    const { onSubmit } = setup([untimed]);

    fireEvent.click(screen.getByRole("button", { name: "Shift by +15 minutes" }));
    fireEvent.click(screen.getByRole("button", { name: "Update 1 Match" }));
    expect(screen.getByText("None of the selected matches has a start time to shift")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("sets one time for every match, starting from the earliest", async () => {
    const { onSubmit } = setup([timed[1], untimed, timed[0]]);

    fireEvent.click(screen.getByRole("tab", { name: "Set to" }));
    const newTime = screen.getByLabelText("New start time");
    expect(newTime).toHaveValue("2026-10-12T10:00");
    expect(screen.getByText("3 matches: 10:00–10:30 → 10:00")).toBeInTheDocument();

    fireEvent.change(newTime, { target: { value: "2026-10-12T15:00" } });
    expect(screen.getByText("3 matches: 10:00–10:30 → 15:00")).toBeInTheDocument();

    save(3);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith([
      { matchId: "m2", startTime: at(15) },
      { matchId: "m3", startTime: at(15) },
      { matchId: "m1", startTime: at(15) },
    ]);
  });

  it("asks for the new time when Set to is empty", () => {
    const { onSubmit } = setup([untimed]);

    fireEvent.click(screen.getByRole("tab", { name: "Set to" }));
    expect(screen.getByLabelText("New start time")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Update 1 Match" }));
    expect(screen.getByText("Choose the new start time")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("some failed: lists just those (the page unticks the rest) with why, to adjust and try again", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const taken = "There is already a match scheduled at the same time at 'Court 1': Lions vs Bears";
    const { onSubmit, onRemoveMatch, rerender } = setup(timed, (updates) =>
      Promise.resolve(
        updates.map(({ matchId }) => (matchId === "m1" ? { matchId, ok: false, error: taken } : { matchId, ok: true }))
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Shift by +30 minutes" }));
    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    rerender(
      <BulkEditMatchModal
        isOpen
        selectedMatches={[timed[0]]}
        onClose={jest.fn()}
        onSubmit={onSubmit}
        onRemoveMatch={onRemoveMatch}
        loading={false}
      />
    );

    const failures = await screen.findByRole("alert");
    expect(failures).toHaveTextContent("Updated 1 of 2 matches. This one couldn't be saved:");
    expect(failures).toHaveTextContent("Falcons vs Sharks");
    expect(failures).toHaveTextContent(taken);
    expect(failures).not.toHaveTextContent("Eagles");

    // What was picked stays, for the retry.
    expect(minutes()).toHaveValue("+30");
    expect(screen.getByText("1 match: 10:00 → 10:30")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove Falcons vs Sharks from this list" }));
    expect(onRemoveMatch).toHaveBeenCalledWith("m1");
    (console.error as jest.Mock).mockRestore();
  });
});

it("court and best of still go to every selected match", async () => {
  const onSubmit = jest.fn((updates: BulkMatchEdit[]) =>
    Promise.resolve(updates.map(({ matchId }) => ({ matchId, ok: true })))
  );
  render(<BulkEditMatchModal isOpen selectedMatches={matches} onClose={jest.fn()} onSubmit={onSubmit} loading={false} />);

  fireEvent.click(screen.getByRole("button", { name: "Update 2 Matches" }));
  expect(screen.getByText("Please select at least one field to update")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("checkbox", { name: "Update Venue" }));
  fireEvent.change(screen.getByLabelText("Venue"), { target: { value: " Court 3 " } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Update Best Of" }));
  fireEvent.click(screen.getByRole("button", { name: "Update 2 Matches" }));
  expect(screen.getByText("Choose a Best Of value")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Best Of"), { target: { value: "5" } });
  fireEvent.click(screen.getByRole("button", { name: "Update 2 Matches" }));

  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  expect(onSubmit).toHaveBeenCalledWith([
    { matchId: "m1", venue: "Court 3", bestOf: 5 },
    { matchId: "m2", venue: "Court 3", bestOf: 5 },
  ]);
});
