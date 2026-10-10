import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MexicanoCourt from "./MexicanoCourt";
import { Match } from "../../matches/types/match";

const court = (over: Partial<Match> = {}): Match => ({
  id: "m1",
  venue: "Court 1",
  round: "Round 1",
  formatType: "Mexicano",
  pointsPerMatch: 24,
  bestOf: 1,
  homeTeamName: "Ali",
  homeTeam2Name: "Dee",
  awayTeamName: "Bea",
  awayTeam2Name: "Cy",
  gameScores: [],
  referees: [],
  refereeTeams: [],
  isCompleted: false,
  ...over,
});

const renderCourt = (match: Match, onScore = jest.fn(), canScore = true) =>
  render(
    <ul>
      <MexicanoCourt match={match} canScore={canScore} onScore={onScore} />
    </ul>
  );

test("a 40-character name still leaves the points on screen", () => {
  const longName = "New Cairo Beach Volleyball Academy Elite";
  expect(longName).toHaveLength(40);
  renderCourt(
    court({ homeTeamName: longName, isCompleted: true, gameScores: [{ gameNumber: 1, homeScore: 16, awayScore: 9 }] })
  );

  // The name sits in the part that truncates; the points are its sibling, so they never get pushed out.
  const name = screen.getByText(`${longName} & Dee`);
  expect(name).toHaveClass("mexicano-court__team-name");
  expect(name.parentElement).toHaveTextContent("16");
  expect(screen.getByText("9")).toHaveClass("mexicano-court__points");
});

test("Score hands the court's match over, and is described by the court's name", () => {
  const onScore = jest.fn();
  const match = court();
  renderCourt(match, onScore);

  const score = screen.getByRole("button", { name: "Score" });
  expect(score).toHaveAccessibleDescription("Court 1");
  fireEvent.click(score);
  expect(onScore).toHaveBeenCalledWith(match);
});

test("a scored court shows the winner and no Score when it isn't allowed", () => {
  renderCourt(
    court({
      isCompleted: true,
      gameScores: [{ gameNumber: 1, homeScore: 10, awayScore: 14 }],
      refereeTeams: [{ teamId: "r1", teamName: "Net Ninjas" }],
    }),
    jest.fn(),
    false
  );

  expect(screen.queryByRole("button", { name: "Score" })).not.toBeInTheDocument();
  expect(screen.getByText("Bea & Cy").parentElement).toHaveClass("mexicano-court__team--win");
  expect(screen.getByText("Ali & Dee").parentElement).toHaveClass("mexicano-court__team--lose");
  expect(screen.getByText("Referee team: Net Ninjas")).toBeInTheDocument();
});
