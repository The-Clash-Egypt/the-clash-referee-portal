import React from "react";
import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import BulkAssignRefereeModal from "./BulkAssignRefereeModal";
import { DRAWER_EXIT_MS } from "../../shared/components/Drawer";
import { Match } from "../types/match";

jest.mock("../../../api/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
// The suggestions hook fetches through React Query; this smoke test never searches.
jest.mock("../hooks/usePlayerSuggestions", () => ({
  usePlayerSuggestions: () => ({ data: [], isLoading: false }),
}));

afterEach(() => jest.useRealTimers());

const matches: Match[] = [
  { id: "m1", homeTeamName: "Falcons", awayTeamName: "Sharks", venue: "Court 1", isCompleted: false },
  { id: "m2", homeTeamName: "Eagles", awayTeamName: "Tigers", venue: "Court 2", isCompleted: false },
];

it("opens as a drawer and slides away once closed", () => {
  jest.useFakeTimers();
  const props = { onClose: jest.fn(), onAssign: jest.fn(), loading: false };
  const { rerender } = render(<BulkAssignRefereeModal isOpen selectedMatches={matches} {...props} />);

  expect(screen.getByRole("dialog", { name: "Bulk Assign Referees" })).toHaveTextContent("Selected Matches (2)");

  rerender(<BulkAssignRefereeModal isOpen={false} selectedMatches={matches} {...props} />);
  act(() => {
    jest.advanceTimersByTime(DRAWER_EXIT_MS);
  });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
