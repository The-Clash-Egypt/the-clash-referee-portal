import React from "react";
import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import BulkEditMatchModal from "./BulkEditMatchModal";
import { DRAWER_EXIT_MS } from "../../shared/components/Drawer";
import { Match } from "../types/match";

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
