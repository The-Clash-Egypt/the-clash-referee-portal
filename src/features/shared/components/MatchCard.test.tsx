import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MatchCard from "./MatchCard";
import { Match } from "../../matches/types/match";

const match = { id: "m1", homeTeamName: "Falcons", awayTeamName: "Sharks", isCompleted: true, homeScore: 2, awayScore: 1 } as Match;

it("offers admins a QR code, completed matches included", () => {
  const onShowQR = jest.fn();
  render(<MatchCard match={match} showAdminActions onShowQR={onShowQR} showAssignReferee={false} />);

  fireEvent.click(screen.getByRole("button", { name: "QR Code" }));

  expect(onShowQR).toHaveBeenCalledWith(match);
});

it("hides the QR button from everyone else", () => {
  render(<MatchCard match={match} onShowQR={jest.fn()} showAssignReferee={false} />);

  expect(screen.queryByRole("button", { name: "QR Code" })).not.toBeInTheDocument();
});
