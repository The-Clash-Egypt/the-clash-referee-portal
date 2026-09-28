import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MatchCard from "./MatchCard";
import { Match } from "../../matches/types/match";

const base = {
  id: "m1",
  venue: "Court 7",
  round: "Round 5",
  homeTeamName: "Ali",
  homeTeam2Name: "Bea",
  awayTeamName: "Cy",
  awayTeam2Name: "Dee",
  isCompleted: true,
  referees: [],
  refereeTeams: [],
} as unknown as Match;

test("a Mexicano match shows its points as the score, not the games won", () => {
  render(
    <MatchCard
      match={{ ...base, formatType: "Mexicano", homeScore: 1, awayScore: 0, gameScores: [{ gameNumber: 1, homeScore: 15, awayScore: 9 }] }}
    />
  );

  expect(screen.getByText("15")).toHaveClass("team-score");
  expect(screen.getByText("9")).toHaveClass("team-score");
  expect(screen.queryByText("1")).not.toBeInTheDocument(); // games won
  expect(screen.queryByText("0")).not.toBeInTheDocument();
});

test("a sets match still shows each game and the sets won", () => {
  render(
    <MatchCard
      match={{
        ...base,
        formatType: "Group",
        homeScore: 2,
        awayScore: 1,
        gameScores: [
          { gameNumber: 1, homeScore: 21, awayScore: 15 },
          { gameNumber: 2, homeScore: 19, awayScore: 21 },
          { gameNumber: 3, homeScore: 17, awayScore: 10 },
        ],
      }}
    />
  );

  expect(screen.getByText("2")).toHaveClass("team-score");
  expect(screen.getByText("1")).toHaveClass("team-score");
  expect(screen.getByText("19")).toHaveClass("team-game-score");
  expect(screen.getByText("17")).toHaveClass("team-game-score");
});
