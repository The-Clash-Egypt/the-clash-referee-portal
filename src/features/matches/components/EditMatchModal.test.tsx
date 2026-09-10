import React from "react";
import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import EditMatchModal from "./EditMatchModal";
import { DRAWER_EXIT_MS } from "../../shared/components/Drawer";
import { Match } from "../types/match";

afterEach(() => jest.useRealTimers());

const match: Match = { id: "m1", homeTeamName: "Falcons", awayTeamName: "Sharks", venue: "Court 1", bestOf: 3, isCompleted: false };

it("opens as a drawer and slides away once closed", () => {
  jest.useFakeTimers();
  const props = { onClose: jest.fn(), onSubmit: jest.fn(), loading: false };
  const { rerender } = render(<EditMatchModal isOpen match={match} {...props} />);

  expect(screen.getByRole("dialog", { name: "Edit Match Details" })).toHaveTextContent("Falcons");
  expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();

  // The page clears the match as it closes; the drawer keeps showing it while it slides out.
  rerender(<EditMatchModal isOpen={false} match={null} {...props} />);
  expect(screen.getByRole("dialog")).toHaveTextContent("Falcons");

  act(() => {
    jest.advanceTimersByTime(DRAWER_EXIT_MS);
  });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
