import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MatchCard from "./MatchCard";
import { Match } from "../../matches/types/match";

const match = { id: "m1", homeTeamName: "Falcons", awayTeamName: "Sharks", isCompleted: true, homeScore: 2, awayScore: 1 } as Match;

it("offers admins a QR code, completed matches included", () => {
  const onShowQR = jest.fn();
  const { container } = render(<MatchCard match={match} showAdminActions onShowQR={onShowQR} showAssignReferee={false} />);

  fireEvent.click(screen.getByRole("button", { name: "QR code" }));

  expect(onShowQR).toHaveBeenCalledWith(match);
  expect(container.querySelector(".match-actions .qr-icon-button")).toBeNull();
  expect(container.querySelector(".tournament-meta .qr-icon-button")).not.toBeNull();
});

it("hides the QR button from everyone else", () => {
  render(<MatchCard match={match} onShowQR={jest.fn()} showAssignReferee={false} />);

  expect(screen.queryByRole("button", { name: "QR code" })).not.toBeInTheDocument();
});

describe("referee teams", () => {
  const refereed = {
    ...match,
    isCompleted: false,
    homeTeamName: "Dunes",
    awayTeamName: "Reef",
    refereeTeams: [
      { teamId: "t1", teamName: "Falcons" },
      { teamId: "t2", teamName: "Sharks" },
    ],
    referees: [{ id: "r1", userId: "u1", fullName: "Mona Salah", email: "mona@example.com", phoneNumber: "" }],
  } as Match;

  it("lists the referee teams first, then the individual referees", () => {
    const { container } = render(<MatchCard match={refereed} />);

    const rows = Array.from(container.querySelectorAll(".referees-list .referee-item"));
    expect(rows.map((row) => row.querySelector(".referee-name")?.textContent)).toEqual(["Falcons", "Sharks", "Mona Salah"]);
    expect(rows.map((row) => row.querySelector(".referee-email")?.textContent)).toEqual([
      "Referee team",
      "Referee team",
      "mona@example.com",
    ]);
    expect(screen.queryByText("No referees assigned for this match")).not.toBeInTheDocument();
  });

  it("lets admins unassign a referee team", () => {
    const onUnassignRefereeTeam = jest.fn(() => Promise.resolve());
    render(<MatchCard match={refereed} showAdminActions onUnassignRefereeTeam={onUnassignRefereeTeam} />);

    fireEvent.click(screen.getByRole("button", { name: "Unassign Sharks" }));

    expect(onUnassignRefereeTeam).toHaveBeenCalledWith("m1", "t2");
  });

  it("offers no unassign to anyone else", () => {
    render(<MatchCard match={refereed} onUnassignRefereeTeam={jest.fn()} />);

    expect(screen.queryByRole("button", { name: /Unassign/ })).not.toBeInTheDocument();
  });

  it("counts a team alone as assigned, and says so only when there is nobody", () => {
    const { rerender } = render(<MatchCard match={{ ...refereed, referees: [] }} />);
    expect(screen.getByText("Falcons")).toBeInTheDocument();
    expect(screen.queryByText("No referees assigned for this match")).not.toBeInTheDocument();

    rerender(<MatchCard match={{ ...refereed, referees: [], refereeTeams: [] }} />);
    expect(screen.getByText("No referees assigned for this match")).toBeInTheDocument();

    rerender(<MatchCard match={match} />);
    expect(screen.getByText("No referees assigned for this match")).toBeInTheDocument();
  });

  it("stays hidden where referees are not shown (the guest pages)", () => {
    render(<MatchCard match={refereed} showAssignReferee={false} />);

    expect(screen.queryByText("Falcons")).not.toBeInTheDocument();
  });
});
