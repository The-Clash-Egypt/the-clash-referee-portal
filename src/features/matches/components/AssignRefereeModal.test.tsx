import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AssignRefereeModal from "./AssignRefereeModal";
import { DRAWER_EXIT_MS } from "../../shared/components/Drawer";
import { useRefereeTeamOptions } from "../hooks/useRefereeTeamOptions";
import { Match, RefereeTeamAssignResult, RefereeTeamOption } from "../types/match";

jest.mock("../../../api/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
// Both hooks fetch through React Query; the drawer is tested against what they return.
jest.mock("../hooks/usePlayerSuggestions", () => ({
  usePlayerSuggestions: (term: string) => ({
    data: term
      ? [{ id: "p1", userId: "u-mona", firstName: "Mona", lastName: "Salah", email: "mona@example.com", nationality: "EG", gender: "F" }]
      : [],
    isLoading: false,
  }),
}));
jest.mock("../hooks/useRefereeTeamOptions", () => ({ useRefereeTeamOptions: jest.fn() }));

const teamOptions = useRefereeTeamOptions as jest.Mock;

const options: RefereeTeamOption[] = [
  { teamId: "t-tigers", teamName: "Tigers", categoryName: "Men's Open", eligibleMatchIds: ["m1"] },
  { teamId: "t-waves", teamName: "Waves", categoryName: "Men's Open", eligibleMatchIds: ["m1"] },
];

const match: Match = { id: "m1", homeTeamName: "Falcons", awayTeamName: "Sharks", venue: "Court 1", isCompleted: false };
const refereed: Match = { ...match, refereeTeams: [{ teamId: "t-eagles", teamName: "Eagles" }] };

const handlers = () => ({
  onClose: jest.fn(),
  onAssign: jest.fn((refereeIds: string[]) => Promise.resolve()),
  onAssignTeams: jest.fn(
    (teamIds: string[], matchIds: string[]): Promise<RefereeTeamAssignResult[] | null> =>
      Promise.resolve([{ matchId: "m1", assignedTeamIds: teamIds, unchangedTeamIds: [], skipped: [] }])
  ),
  onUnassignTeam: jest.fn((matchId: string, teamId: string) => Promise.resolve()),
  loading: false,
});

beforeEach(() => teamOptions.mockReturnValue({ data: options, isLoading: false, isError: false }));
afterEach(() => jest.useRealTimers());

const assignButton = () => screen.queryByRole("button", { name: /^Assign/ });

it("opens as a drawer and slides away once closed", () => {
  jest.useFakeTimers();
  const props = { match, ...handlers() };
  const { rerender } = render(<AssignRefereeModal isOpen {...props} />);

  expect(screen.getByRole("dialog", { name: "Assign Referees to Match" })).toHaveTextContent("Falcons vs Sharks");

  rerender(<AssignRefereeModal isOpen={false} {...props} />);
  act(() => {
    jest.advanceTimersByTime(DRAWER_EXIT_MS);
  });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("offers the category's teams above the individual referees, next to the ones already assigned", () => {
  render(<AssignRefereeModal isOpen match={refereed} {...handlers()} />);

  expect(teamOptions).toHaveBeenCalledWith(["m1"], true);
  expect(screen.getByText("Currently Assigned Referee Teams")).toBeInTheDocument();
  expect(screen.getByText("Eagles")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add Tigers" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add Waves" })).toBeInTheDocument();

  const text = screen.getByRole("dialog").textContent ?? "";
  expect(text.indexOf("Add Referee Teams")).toBeLessThan(text.indexOf("Add Referees"));

  fireEvent.change(screen.getByRole("textbox", { name: "Search referee teams" }), { target: { value: "wav" } });
  expect(screen.queryByRole("button", { name: "Add Tigers" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add Waves" })).toBeInTheDocument();
});

it("says when no team can referee the match", () => {
  teamOptions.mockReturnValue({ data: [], isLoading: false, isError: false });
  render(<AssignRefereeModal isOpen match={match} {...handlers()} />);

  expect(screen.getByText("No other team in this category can referee this match.")).toBeInTheDocument();
});

it("counts picked teams in the footer and assigns teams and referees together", async () => {
  const props = handlers();
  render(<AssignRefereeModal isOpen match={match} {...props} />);
  expect(assignButton()).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Add Tigers" }));
  expect(screen.getByText("Referee Teams to Assign (1)")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add Tigers" })).not.toBeInTheDocument();
  expect(assignButton()).toHaveTextContent("Assign 1 Team");

  fireEvent.change(screen.getByPlaceholderText("Search by name or email..."), { target: { value: "mo" } });
  fireEvent.click(await screen.findByText("Mona Salah"));
  expect(assignButton()).toHaveTextContent("Assign 1 Team, 1 Referee");

  fireEvent.click(assignButton()!);

  await waitFor(() => expect(props.onAssign).toHaveBeenCalledWith(["u-mona"]));
  expect(props.onAssignTeams).toHaveBeenCalledWith(["t-tigers"], ["m1"]);
  await waitFor(() => expect(assignButton()).not.toBeInTheDocument());
});

it("closes after assigning teams alone, and names any team the server skipped", async () => {
  const alert = jest.spyOn(window, "alert").mockImplementation(() => undefined);
  const props = handlers();
  props.onAssignTeams.mockResolvedValue([
    { matchId: "m1", assignedTeamIds: ["t-waves"], unchangedTeamIds: [], skipped: [{ teamId: "t-tigers", reason: "plays in this match" }] },
  ]);
  render(<AssignRefereeModal isOpen match={match} {...props} />);

  fireEvent.click(screen.getByRole("button", { name: "Add Tigers" }));
  fireEvent.click(screen.getByRole("button", { name: "Add Waves" }));
  fireEvent.click(assignButton()!);

  await waitFor(() => expect(props.onClose).toHaveBeenCalled());
  expect(props.onAssignTeams).toHaveBeenCalledWith(["t-tigers", "t-waves"], ["m1"]);
  expect(props.onAssign).not.toHaveBeenCalled();
  expect(alert).toHaveBeenCalledWith("Couldn't assign Tigers (plays in this match).");
  alert.mockRestore();
});

it("keeps the picks when the team request fails", async () => {
  const props = handlers();
  props.onAssignTeams.mockResolvedValue(null);
  render(<AssignRefereeModal isOpen match={match} {...props} />);

  fireEvent.click(screen.getByRole("button", { name: "Add Tigers" }));
  fireEvent.click(assignButton()!);

  await waitFor(() => expect(assignButton()).toBeEnabled());
  expect(assignButton()).toHaveTextContent("Assign 1 Team");
  expect(props.onClose).not.toHaveBeenCalled();
});

it("unassigns a current team, once confirmed, without leaving the drawer", async () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
  const props = handlers();
  render(<AssignRefereeModal isOpen match={refereed} {...props} />);

  // The card's unassign control, not the local remove "×" of the picks below it.
  const unassign = screen.getByRole("button", { name: "Unassign Eagles" });
  expect(unassign).toHaveClass("unassign-button");
  expect(unassign).toHaveTextContent(/^-$/);
  fireEvent.click(unassign);

  expect(confirm).toHaveBeenCalledWith("Unassign Eagles?");
  expect(unassign).toBeDisabled();
  await waitFor(() => expect(unassign).toBeEnabled());
  expect(props.onUnassignTeam).toHaveBeenCalledWith("m1", "t-eagles");
  expect(props.onClose).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog", { name: "Assign Referees to Match" })).toBeInTheDocument();
  confirm.mockRestore();
});

it("leaves a current team alone when the unassign isn't confirmed", () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  const props = handlers();
  render(<AssignRefereeModal isOpen match={refereed} {...props} />);

  fireEvent.click(screen.getByRole("button", { name: "Unassign Eagles" }));

  expect(props.onUnassignTeam).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Unassign Eagles" })).toBeEnabled();
  confirm.mockRestore();
});

it("holds every team's unassign control while one unassign is in flight", async () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
  const props = handlers();
  let finish: () => void = () => undefined;
  props.onUnassignTeam.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
  const twoTeams: Match = { ...match, refereeTeams: [...refereed.refereeTeams!, { teamId: "t-dunes", teamName: "Dunes" }] };
  render(<AssignRefereeModal isOpen match={twoTeams} {...props} />);

  fireEvent.click(screen.getByRole("button", { name: "Unassign Eagles" }));

  expect(screen.getByRole("button", { name: "Unassign Dunes" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Unassign Dunes" }));
  expect(props.onUnassignTeam).toHaveBeenCalledTimes(1);

  await act(async () => finish());
  expect(screen.getByRole("button", { name: "Unassign Dunes" })).toBeEnabled();
  confirm.mockRestore();
});

it("keeps keyboard focus in the drawer after picking or removing a team", () => {
  render(<AssignRefereeModal isOpen match={match} {...handlers()} />);
  const search = screen.getByRole("textbox", { name: "Search referee teams" });

  const tigers = screen.getByRole("button", { name: "Add Tigers" });
  tigers.focus();
  fireEvent.keyDown(tigers, { key: "Enter" });
  expect(screen.getByText("Referee Teams to Assign (1)")).toBeInTheDocument();
  expect(search).toHaveFocus();

  // A keyboard press on a button fires its click with detail 0.
  const remove = screen.getByRole("button", { name: "Remove Tigers" });
  remove.focus();
  fireEvent.click(remove, { detail: 0 });
  expect(screen.queryByText("Referee Teams to Assign (1)")).not.toBeInTheDocument();
  expect(search).toHaveFocus();
});

it("leaves focus alone after a tap, so a phone doesn't pop its keyboard", () => {
  render(<AssignRefereeModal isOpen match={match} {...handlers()} />);

  fireEvent.click(screen.getByRole("button", { name: "Add Tigers" }), { detail: 1 });

  expect(screen.getByText("Referee Teams to Assign (1)")).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Search referee teams" })).not.toHaveFocus();
});
