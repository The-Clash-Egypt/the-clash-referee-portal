import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import MatchSheet from "./MatchSheet";
import { Match } from "../../types/match";

const match = {
  id: "m1",
  venue: "Court 1",
  startTime: "2026-10-12T15:00:00",
  categoryName: "Men's Open",
  round: "Round of 16",
  homeTeamName: "Sand Sharks",
  awayTeamName: "Blue Wave",
  homeTeamMembers: [
    { id: "p1", firstName: "Ali", lastName: "Hassan", isCaptain: true },
    { id: "p2", firstName: "Karim", lastName: "Mostafa" },
  ],
  isCompleted: false,
  startedAt: "2026-10-12T15:02:00",
  gameScores: [
    { gameNumber: 1, homeScore: 21, awayScore: 18 },
    { gameNumber: 2, homeScore: 9, awayScore: 7 },
  ],
  referees: [{ id: "r1", userId: "u1", fullName: "Ahmed Kamal", email: "ahmed@example.com", phoneNumber: "201001234567" }],
  refereeTeams: [{ teamId: "t1", teamName: "Net Ninjas" }],
} as unknown as Match;

const handlers = () => ({
  onClose: jest.fn(),
  onScore: jest.fn(),
  onAssignReferee: jest.fn(),
  onShare: jest.fn(),
  onShowQR: jest.fn(),
  onEdit: jest.fn(),
  onShareWithReferee: jest.fn(),
  onUnassignReferee: jest.fn(),
  onUnassignTeam: jest.fn(),
});

const open = (props: { match: Match; fullAccess: boolean }, h = handlers()) => {
  render(<MatchSheet isOpen {...props} {...h} />);
  return h;
};

test("a plain referee gets Score and Share only: no Referee, QR code or Edit, no remove or WhatsApp", () => {
  const h = open({ match, fullAccess: false });
  const sheet = screen.getByRole("dialog");

  expect(within(sheet).getByRole("button", { name: /score/i })).toBeInTheDocument();
  expect(within(sheet).getByRole("button", { name: "Share" })).toBeInTheDocument();
  expect(within(sheet).queryByRole("button", { name: "Referee" })).not.toBeInTheDocument();
  expect(within(sheet).queryByRole("button", { name: "QR code" })).not.toBeInTheDocument();
  expect(within(sheet).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  expect(within(sheet).queryByRole("button", { name: /unassign/i })).not.toBeInTheDocument();
  expect(within(sheet).queryByRole("button", { name: /whatsapp/i })).not.toBeInTheDocument();
  // Who referees it is still shown (with the email, as before).
  expect(within(sheet).getByText("Ahmed Kamal")).toBeInTheDocument();
  expect(within(sheet).getByText("ahmed@example.com")).toBeInTheDocument();

  fireEvent.click(within(sheet).getByRole("button", { name: "Share" }));
  expect(h.onShare).toHaveBeenCalledWith(match);
});

test("Score: until it's completed for a referee, always with full access", () => {
  open({ match: { ...match, isCompleted: true }, fullAccess: false });
  expect(screen.queryByRole("button", { name: /^score$/i })).not.toBeInTheDocument();
});

test("full access: every tile, WhatsApp and remove for referees and referee teams", () => {
  const h = open({ match: { ...match, isCompleted: true, homeScore: 2, awayScore: 0 }, fullAccess: true });
  const sheet = screen.getByRole("dialog");

  fireEvent.click(within(sheet).getByRole("button", { name: /^score$/i }));
  expect(h.onScore).toHaveBeenCalled();
  fireEvent.click(within(sheet).getByRole("button", { name: "Referee" }));
  expect(h.onAssignReferee).toHaveBeenCalled();
  fireEvent.click(within(sheet).getByRole("button", { name: "QR code" }));
  expect(h.onShowQR).toHaveBeenCalled();
  fireEvent.click(within(sheet).getByRole("button", { name: "Edit" }));
  expect(h.onEdit).toHaveBeenCalled();

  expect(within(sheet).getByText("201001234567")).toBeInTheDocument();
  fireEvent.click(within(sheet).getByRole("button", { name: /share this match with Ahmed Kamal on whatsapp/i }));
  expect(h.onShareWithReferee).toHaveBeenCalledWith(expect.objectContaining({ id: "m1" }), match.referees![0]);

  fireEvent.click(within(sheet).getByRole("button", { name: "Unassign Ahmed Kamal" }));
  expect(h.onUnassignReferee).toHaveBeenCalledWith("r1", "m1");
  fireEvent.click(within(sheet).getByRole("button", { name: "Unassign Net Ninjas" }));
  expect(h.onUnassignTeam).toHaveBeenCalledWith("m1", "t1");
});

test("status, where and when, players and the live set", () => {
  open({ match, fullAccess: false });
  const sheet = screen.getByRole("dialog");
  expect(within(sheet).getByText("Live · Set 2")).toBeInTheDocument();
  expect(within(sheet).getByText(/Court 1 · .*15:00 · Men's Open · Round of 16/)).toBeInTheDocument();
  expect(within(sheet).getByText("Ali Hassan (C) · Karim Mostafa")).toBeInTheDocument();
  expect(within(sheet).getByText("9")).toHaveClass("match-sheet__score--current");
  expect(within(sheet).getByText("21")).toHaveClass("match-sheet__score--done");
});

test("nobody refereeing says so; a referee team alone counts", () => {
  const { rerender } = render(<MatchSheet isOpen match={{ ...match, referees: [], refereeTeams: [] }} fullAccess={false} {...handlers()} />);
  expect(screen.getByText("No referees assigned for this match")).toBeInTheDocument();

  rerender(<MatchSheet isOpen match={{ ...match, referees: [] }} fullAccess={false} {...handlers()} />);
  expect(screen.queryByText("No referees assigned for this match")).not.toBeInTheDocument();
  expect(screen.getByText("Net Ninjas")).toBeInTheDocument();
  expect(screen.getByText("Referee team")).toBeInTheDocument();
});

// Ported from MatchCard.points.test.tsx
describe("points or sets", () => {
  const finished = { ...match, startedAt: undefined, isCompleted: true, referees: [], refereeTeams: [] } as unknown as Match;

  test("a Mexicano match shows its points as the score, not the games won", () => {
    open({
      match: { ...finished, formatType: "Mexicano", homeScore: 1, awayScore: 0, gameScores: [{ gameNumber: 1, homeScore: 15, awayScore: 9 }] },
      fullAccess: false,
    });

    expect(screen.getByText("15")).toHaveClass("match-sheet__score--result");
    expect(screen.getByText("9")).toHaveClass("match-sheet__score--result");
    expect(screen.queryByText("1")).not.toBeInTheDocument(); // games won
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  test("a sets match still shows each game and the sets won", () => {
    open({
      match: {
        ...finished,
        formatType: "Group",
        homeScore: 2,
        awayScore: 1,
        gameScores: [
          { gameNumber: 1, homeScore: 21, awayScore: 15 },
          { gameNumber: 2, homeScore: 19, awayScore: 21 },
          { gameNumber: 3, homeScore: 17, awayScore: 10 },
        ],
      },
      fullAccess: false,
    });

    expect(screen.getByText("2")).toHaveClass("match-sheet__score--won");
    expect(screen.getByText("1")).toHaveClass("match-sheet__score--won");
    expect(screen.getByText("19")).toHaveClass("match-sheet__score--final");
    expect(screen.getByText("17")).toHaveClass("match-sheet__score--final");
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });
});

test("durations only with full access", () => {
  const timed = { ...match, isCompleted: true, endedAt: "2026-10-12T15:48:00" } as Match;
  const { unmount } = render(<MatchSheet isOpen match={timed} fullAccess={false} {...handlers()} />);
  expect(screen.queryByText(/Duration/)).not.toBeInTheDocument();
  unmount();

  render(<MatchSheet isOpen match={timed} fullAccess {...handlers()} />);
  expect(screen.getByText(/Started 15:02 · Ended 15:48 · Duration 46m/)).toBeInTheDocument();
});
