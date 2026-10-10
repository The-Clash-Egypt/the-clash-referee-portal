import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MatchRow from "./MatchRow";
import { Match } from "../../types/match";

const base = {
  id: "m1",
  venue: "Court 1",
  startTime: "2026-10-12T15:00:00",
  categoryName: "Men's Open",
  round: "Round of 16",
  homeTeamName: "Sand Sharks",
  awayTeamName: "Blue Wave",
  isCompleted: false,
  referees: [],
  refereeTeams: [],
} as unknown as Match;

const setsOf = (container: HTMLElement) =>
  Array.from(container.querySelectorAll(".match-row__team")).map((team) =>
    Array.from(team.querySelectorAll(".match-row__set")).map((set) => set.textContent)
  );

test("a 40-character team name still leaves the score on screen", () => {
  const longName = "New Cairo Beach Volleyball Academy Elite";
  expect(longName).toHaveLength(40);
  const { container } = render(
    <MatchRow
      match={{ ...base, homeTeamName: longName, startedAt: "2026-10-12T15:02:00", gameScores: [{ gameNumber: 1, homeScore: 14, awayScore: 11 }] }}
      onOpen={jest.fn()}
    />
  );

  const name = screen.getByText(longName);
  expect(name).toHaveClass("match-row__name"); // truncates with an ellipsis (MatchRow.scss), the sets don't shrink
  expect(name.nextElementSibling).toHaveClass("match-row__sets");
  expect(setsOf(container)).toEqual([["14"], ["11"]]);
});

test("a live match: red stripe, Live · Set N, earlier sets muted and the current one red", () => {
  const { container } = render(
    <MatchRow
      match={{
        ...base,
        startedAt: "2026-10-12T15:02:00",
        gameScores: [
          { gameNumber: 2, homeScore: 9, awayScore: 7 },
          { gameNumber: 1, homeScore: 21, awayScore: 18 },
        ],
        referees: [{ id: "r1", userId: "u1", fullName: "Ahmed Kamal", email: "a@x.com", phoneNumber: "0100" }],
      }}
      onOpen={jest.fn()}
    />
  );

  expect(container.querySelector(".match-row--live .match-row__stripe")).not.toBeNull();
  expect(screen.getByText("Live · Set 2")).toHaveClass("ui-tag--live");
  expect(setsOf(container)).toEqual([["21", "9"], ["18", "7"]]);
  expect(screen.getByText("9")).toHaveClass("match-row__set--current");
  expect(screen.getByText("21")).toHaveClass("match-row__set--done");
  expect(screen.getByText(/Ahmed K\./)).toHaveClass("match-row__ref");
  expect(screen.getByText("C1")).toBeInTheDocument();
  expect(screen.getByText("15:00")).toBeInTheDocument();
});

test("not live: no stripe, a grey category · round tag, and an orange No referee", () => {
  const onOpen = jest.fn();
  const { container } = render(<MatchRow match={base} onOpen={onOpen} />);

  expect(container.querySelector(".match-row__stripe")).toBeNull();
  expect(screen.getByText("Men's Open · Round of 16").closest(".ui-tag")).toHaveClass("ui-tag--grey");
  expect(screen.getByText("No referee")).toHaveClass("match-row__ref--none");
  expect(container.querySelectorAll(".match-row__set")).toHaveLength(0);

  fireEvent.click(screen.getByRole("button"));
  expect(onOpen).toHaveBeenCalledWith(base);
});

test("a referee team alone counts as refereed", () => {
  render(<MatchRow match={{ ...base, refereeTeams: [{ teamId: "t1", teamName: "Net Ninjas" }] }} onOpen={jest.fn()} />);
  expect(screen.queryByText("No referee")).not.toBeInTheDocument();
  expect(screen.getByText(/Net Ninjas/)).toBeInTheDocument();
});

test("a finished match: winner bold, loser muted", () => {
  const { container } = render(
    <MatchRow
      match={{
        ...base,
        isCompleted: true,
        homeScore: 1,
        awayScore: 2,
        gameScores: [
          { gameNumber: 1, homeScore: 21, awayScore: 15 },
          { gameNumber: 2, homeScore: 19, awayScore: 21 },
          { gameNumber: 3, homeScore: 10, awayScore: 15 },
        ],
      }}
      onOpen={jest.fn()}
    />
  );
  const [home, away] = Array.from(container.querySelectorAll(".match-row__team"));
  expect(home).toHaveClass("match-row__team--lose");
  expect(away).toHaveClass("match-row__team--win");
  expect(setsOf(container)).toEqual([["21", "19", "10"], ["15", "21", "15"]]);
});

// Ported from MatchCard.points.test.tsx: Americano/Mexicano score in points, not games won.
test("a Mexicano match shows its points as the score, not the games won", () => {
  const { container } = render(
    <MatchRow
      match={{
        ...base,
        formatType: "Mexicano",
        homeTeamName: "Ali",
        homeTeam2Name: "Bea",
        awayTeamName: "Cy",
        awayTeam2Name: "Dee",
        isCompleted: true,
        homeScore: 1,
        awayScore: 0,
        gameScores: [{ gameNumber: 1, homeScore: 15, awayScore: 9 }],
      }}
      onOpen={jest.fn()}
    />
  );

  expect(setsOf(container)).toEqual([["15"], ["9"]]);
  expect(screen.queryByText("1")).not.toBeInTheDocument();
  expect(screen.queryByText("0")).not.toBeInTheDocument();
  expect(screen.getByText("Ali & Bea")).toBeInTheDocument();
});

test("a match without a court or a time", () => {
  render(<MatchRow match={{ ...base, venue: undefined, startTime: undefined }} onOpen={jest.fn()} />);
  expect(screen.getAllByText("—")).toHaveLength(2);
});
