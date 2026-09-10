import React from "react";
import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AssignRefereeModal from "./AssignRefereeModal";
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

const match: Match = { id: "m1", homeTeamName: "Falcons", awayTeamName: "Sharks", venue: "Court 1", isCompleted: false };

it("opens as a drawer and slides away once closed", () => {
  jest.useFakeTimers();
  const props = { match, onClose: jest.fn(), onAssign: jest.fn(), loading: false };
  const { rerender } = render(<AssignRefereeModal isOpen {...props} />);

  expect(screen.getByRole("dialog", { name: "Assign Referees to Match" })).toHaveTextContent("Falcons vs Sharks");

  rerender(<AssignRefereeModal isOpen={false} {...props} />);
  act(() => {
    jest.advanceTimersByTime(DRAWER_EXIT_MS);
  });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
