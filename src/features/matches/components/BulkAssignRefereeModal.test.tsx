import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import BulkAssignRefereeModal from "./BulkAssignRefereeModal";
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

afterEach(() => jest.useRealTimers());

const matches: Match[] = [
  { id: "m1", homeTeamName: "Falcons", awayTeamName: "Sharks", venue: "Court 1", isCompleted: false },
  { id: "m2", homeTeamName: "Eagles", awayTeamName: "Tigers", venue: "Court 2", isCompleted: false },
];

// Two men's matches and one women's: Falcons plays #1, and neither men's team can take #3.
const acrossCategories: Match[] = [
  { ...matches[0], categoryName: "Men's Open" },
  { ...matches[1], categoryName: "Men's Open" },
  { id: "m3", homeTeamName: "Pearls", awayTeamName: "Corals", venue: "Court 3", categoryName: "Women's Open", isCompleted: false },
];
const options: RefereeTeamOption[] = [
  { teamId: "t-falcons", teamName: "Falcons", categoryName: "Men's Open", eligibleMatchIds: ["m2"] },
  { teamId: "t-waves", teamName: "Waves", categoryName: "Men's Open", eligibleMatchIds: ["m1", "m2"] },
  { teamId: "t-dunes", teamName: "Dunes", categoryName: "Women's Open", eligibleMatchIds: ["m3"] },
];

const handlers = () => ({
  onClose: jest.fn(),
  onAssign: jest.fn((refereeIds: string[], matchIds: string[], keepOpen?: boolean) => Promise.resolve(true)),
  onAssignTeams: jest.fn(
    (teamIds: string[], matchIds: string[]): Promise<RefereeTeamAssignResult[] | null> => Promise.resolve([])
  ),
  loading: false,
});

beforeEach(() => teamOptions.mockReturnValue({ data: options, isLoading: false, isError: false }));

const assignButton = () => screen.queryByRole("button", { name: /^Assign/ });

it("opens as a drawer and slides away once closed", () => {
  jest.useFakeTimers();
  const props = handlers();
  const { rerender } = render(<BulkAssignRefereeModal isOpen selectedMatches={matches} {...props} />);

  expect(screen.getByRole("dialog", { name: "Bulk Assign Referees" })).toHaveTextContent("Selected Matches (2)");

  rerender(<BulkAssignRefereeModal isOpen={false} selectedMatches={matches} {...props} />);
  act(() => {
    jest.advanceTimersByTime(DRAWER_EXIT_MS);
  });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("offers the teams for every selected match, with their category when the matches span several", () => {
  render(<BulkAssignRefereeModal isOpen selectedMatches={acrossCategories} {...handlers()} />);

  expect(teamOptions).toHaveBeenCalledWith(["m1", "m2", "m3"], true);
  // The detail line is part of each option's name, so same-named teams in two categories stay apart.
  expect(screen.getByRole("button", { name: "Add Falcons, Men's Open · eligible for 1 of 3 matches" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add Waves, Men's Open · eligible for 2 of 3 matches" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add Dunes, Women's Open · eligible for 1 of 3 matches" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /^Add Falcons/ }));
  expect(screen.getByRole("button", { name: "Remove Falcons, Men's Open · eligible for 1 of 3 matches" })).toBeInTheDocument();
});

it("leaves the category off when every selected match shares it", () => {
  teamOptions.mockReturnValue({ data: [options[1]], isLoading: false, isError: false });
  render(<BulkAssignRefereeModal isOpen selectedMatches={acrossCategories.slice(0, 2)} {...handlers()} />);

  expect(screen.getByRole("button", { name: "Add Waves" })).not.toHaveTextContent("Men's Open");
  expect(screen.getByRole("button", { name: "Add Waves" })).not.toHaveTextContent("eligible");
});

it("assigns the picked teams in one request and reports what was skipped", async () => {
  const props = handlers();
  props.onAssignTeams.mockResolvedValue([
    { matchId: "m1", assignedTeamIds: ["t-waves"], unchangedTeamIds: [], skipped: [{ teamId: "t-falcons", reason: "plays in this match" }] },
    { matchId: "m2", assignedTeamIds: ["t-falcons", "t-waves"], unchangedTeamIds: [], skipped: [] },
    {
      matchId: "m3",
      assignedTeamIds: [],
      unchangedTeamIds: [],
      skipped: [
        { teamId: "t-falcons", reason: "different category" },
        { teamId: "t-waves", reason: "different category" },
      ],
    },
  ]);
  render(<BulkAssignRefereeModal isOpen selectedMatches={acrossCategories} {...props} />);
  // The live region is there, empty, before anything is assigned, so its new text is announced.
  const status = screen.getByRole("status");
  expect(status).toBeEmptyDOMElement();

  fireEvent.click(screen.getByRole("button", { name: /^Add Falcons/ }));
  fireEvent.click(screen.getByRole("button", { name: /^Add Waves/ }));
  // Neither team fits all three matches, so the button doesn't promise them all.
  expect(assignButton()).toHaveTextContent(/^Assign 2 Teams$/);
  fireEvent.click(assignButton()!);

  // The skipped match is named, since the drawer lists only some of the matches and no numbers.
  await waitFor(() =>
    expect(status).toHaveTextContent("Assigned to 2 matches · skipped 3 (Falcons plays in Falcons vs Sharks; different category ×2)")
  );
  expect(screen.getByRole("status")).toBe(status);
  expect(props.onAssignTeams).toHaveBeenCalledTimes(1);
  expect(props.onAssignTeams).toHaveBeenCalledWith(["t-falcons", "t-waves"], ["m1", "m2", "m3"]);
  expect(props.onAssign).not.toHaveBeenCalled();
  expect(props.onClose).not.toHaveBeenCalled();
  expect(assignButton()).not.toBeInTheDocument();
});

it("asks the page to keep the drawer open when referees go on with teams, and confirms both", async () => {
  const props = handlers();
  props.onAssignTeams.mockResolvedValue([
    { matchId: "m1", assignedTeamIds: ["t-waves"], unchangedTeamIds: [], skipped: [] },
    { matchId: "m2", assignedTeamIds: ["t-waves"], unchangedTeamIds: [], skipped: [] },
  ]);
  render(<BulkAssignRefereeModal isOpen selectedMatches={matches} {...props} />);

  fireEvent.click(screen.getByRole("button", { name: /^Add Waves/ }));
  fireEvent.change(screen.getByPlaceholderText("Search by name or email..."), { target: { value: "mo" } });
  fireEvent.click(await screen.findByText("Mona Salah"));
  expect(assignButton()).toHaveTextContent("Assign 1 Team, 1 Referee to 2 Matches");
  fireEvent.click(assignButton()!);

  await waitFor(() => expect(props.onAssign).toHaveBeenCalledWith(["u-mona"], ["m1", "m2"], true));
  expect(props.onAssignTeams).toHaveBeenCalledWith(["t-waves"], ["m1", "m2"]);
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent(/^Assigned to 2 matches · 1 referee assigned to 2 matches$/)
  );
  expect(screen.queryByText("Referees to Assign (1)")).not.toBeInTheDocument();
});

it("keeps the referee picks, and confirms only the teams, when the page reports the referees failed", async () => {
  const props = handlers();
  props.onAssignTeams.mockResolvedValue([
    { matchId: "m1", assignedTeamIds: ["t-waves"], unchangedTeamIds: [], skipped: [] },
    { matchId: "m2", assignedTeamIds: ["t-waves"], unchangedTeamIds: [], skipped: [] },
  ]);
  props.onAssign.mockResolvedValue(false);
  render(<BulkAssignRefereeModal isOpen selectedMatches={matches} {...props} />);

  fireEvent.click(screen.getByRole("button", { name: /^Add Waves/ }));
  fireEvent.change(screen.getByPlaceholderText("Search by name or email..."), { target: { value: "mo" } });
  fireEvent.click(await screen.findByText("Mona Salah"));
  fireEvent.click(assignButton()!);

  await waitFor(() => expect(assignButton()).toHaveTextContent("Assign 1 Referee to 2 Matches"));
  expect(screen.getByRole("status")).toHaveTextContent(/^Assigned to 2 matches$/);
  expect(screen.getByText("Referees to Assign (1)")).toBeInTheDocument();
});

it("labels a mixed pick so only the referees are promised every match", async () => {
  render(<BulkAssignRefereeModal isOpen selectedMatches={acrossCategories} {...handlers()} />);

  fireEvent.click(screen.getByRole("button", { name: /^Add Waves/ }));
  fireEvent.change(screen.getByPlaceholderText("Search by name or email..."), { target: { value: "mo" } });
  fireEvent.click(await screen.findByText("Mona Salah"));

  expect(assignButton()).toHaveTextContent("Assign 1 Team · 1 Referee to 3 Matches");
});

it("hands referees alone to the page without keepOpen, and clears the picks", async () => {
  const props = handlers();
  render(<BulkAssignRefereeModal isOpen selectedMatches={matches} {...props} />);

  fireEvent.change(screen.getByPlaceholderText("Search by name or email..."), { target: { value: "mo" } });
  fireEvent.click(await screen.findByText("Mona Salah"));
  fireEvent.click(assignButton()!);

  await waitFor(() => expect(props.onAssign).toHaveBeenCalledWith(["u-mona"], ["m1", "m2"], false));
  expect(props.onAssignTeams).not.toHaveBeenCalled();
  await waitFor(() => expect(assignButton()).not.toBeInTheDocument());
});
