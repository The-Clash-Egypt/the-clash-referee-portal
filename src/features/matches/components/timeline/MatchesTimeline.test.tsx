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

const renderLive = (matches: Match[], courts: string[]) =>
  render(<MatchesTimeline matches={matches} tab="live" showDates courts={courts} onOpen={jest.fn()} />);

// Review M6
test("rows give clashing courts their full names, and the others their short ones", () => {
  renderLive(
    [match("a", "Court 1", at(0, 0)), match("b", "Beach Court 1", at(0, 0)), match("c", "Court 2", at(0, 0))],
    ["Court 1", "Beach Court 1", "Court 2"]
  );

  expect(within(rowOf("Home a")).getByTitle("Court 1")).toHaveTextContent(/^Court 1$/);
  expect(within(rowOf("Home b")).getByTitle("Beach Court 1")).toHaveTextContent(/^Beach Court 1$/);
  expect(within(rowOf("Home c")).getByTitle("Court 2")).toHaveTextContent(/^C2$/);
});

// Review M1
test("Live with every day shown: a match left open on an earlier day sits under its day, not under Now", () => {
  const yesterday = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(at(1, 9))
  );
  renderLive([match("today", "Court 1", at(0, 0)), match("old", "Court 2", at(1, 9))], ["Court 1", "Court 2"]);

  const headings = screen.getAllByRole("heading").map((heading) => heading.textContent);
  expect(headings).toEqual(["Now", yesterday, "09:00"]);
});
