import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import MatchesTimeline from "./MatchesTimeline";
import { Match } from "../../types/match";

const at = (daysAgo: number, hour: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

const match = (id: string, venue: string, startTime: string): Match =>
  ({ id, venue, startTime, homeTeamName: `Home ${id}`, awayTeamName: `Away ${id}`, isCompleted: false }) as Match;

const rowOf = (team: string) => screen.getByRole("button", { name: new RegExp(team) });

const renderLive = (matches: Match[]) => render(<MatchesTimeline matches={matches} tab="live" showDates onOpen={jest.fn()} />);

// Review M6, then Task 10 (owner: "Court 2", not "C2"): every row names its court in full, so "Court 1" and
// "Beach Court 1" never read the same.
test("rows name their courts in full", () => {
  renderLive([match("a", "Court 1", at(0, 0)), match("b", "Beach Court 1", at(0, 0)), match("c", "Court 2", at(0, 0))]);

  expect(within(rowOf("Home a")).getByTitle("Court 1")).toHaveTextContent(/^Court 1$/);
  expect(within(rowOf("Home b")).getByTitle("Beach Court 1")).toHaveTextContent(/^Beach Court 1$/);
  expect(within(rowOf("Home c")).getByTitle("Court 2")).toHaveTextContent(/^Court 2$/);
});

// Review M1
test("Live with every day shown: a match left open on an earlier day sits under its day, not under Now", () => {
  const yesterday = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(at(1, 9))
  );
  renderLive([match("today", "Court 1", at(0, 0)), match("old", "Court 2", at(1, 9))]);

  const headings = screen.getAllByRole("heading").map((heading) => heading.textContent);
  expect(headings).toEqual(["Now", yesterday, "09:00"]);
});

// Task 10 (owner): the All tab.
test("All: every match under its start time, earliest first, live and finished ones as on their own tabs, no time last", () => {
  const live = {
    ...match("live", "Court 1", at(0, 10)),
    startedAt: at(0, 10),
    gameScores: [{ gameNumber: 1, homeScore: 9, awayScore: 7 }],
  };
  const done = {
    ...match("done", "Court 2", at(0, 9)),
    isCompleted: true,
    homeScore: 1,
    awayScore: 0,
    gameScores: [{ gameNumber: 1, homeScore: 21, awayScore: 15 }],
  };
  const next = match("next", "Court 3", at(0, 11));
  const untimed = { ...match("untimed", "Court 4", at(0, 0)), startTime: undefined };

  render(<MatchesTimeline matches={[untimed, next, done, live]} tab="all" showDates={false} onOpen={jest.fn()} />);

  expect(screen.getAllByRole("heading").map((heading) => heading.textContent)).toEqual(["09:00", "10:00", "11:00", "No time"]);
  expect(within(rowOf("Home live")).getByText("Live · Set 1")).toBeInTheDocument();
  expect(rowOf("Home live").querySelector(".match-row__stripe")).not.toBeNull();
  expect(within(rowOf("Home done")).getByText("21")).toBeInTheDocument();
  expect(rowOf("Home done").querySelector(".match-row__stripe")).toBeNull();
});
