import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import TournamentCard from "./TournamentCard";
import { Tournament } from "../types";

// Jest 27 (CRA) can't resolve react-router-dom v7; react-router exports the same API (it needs TextEncoder).
jest.mock(
  "react-router-dom",
  () => {
    const { TextEncoder, TextDecoder } = jest.requireActual("util");
    Object.assign(global, { TextEncoder, TextDecoder });
    return jest.requireActual("react-router");
  },
  { virtual: true }
);

const thisYear = new Date().getFullYear();

const card = (startDate: string, endDate: string) =>
  render(
    <MemoryRouter>
      <TournamentCard
        tournament={{ id: "t1", name: "Summer Clash Open", status: "active", startDate, endDate } as Tournament}
      />
    </MemoryRouter>
  );

// The mockup's cards: "11 – 13 Oct · 3 days" and "12 Oct · 1 day" (both ends counted; it used to say "Same day").
test("a one-day tournament reads 1 day", () => {
  card(`${thisYear}-10-12T00:00:00`, `${thisYear}-10-12T00:00:00`);
  expect(screen.getByText("12 Oct · 1 day")).toBeInTheDocument();
});

test("a tournament over three days reads 3 days, whatever the times", () => {
  card(`${thisYear}-10-11T00:00:00`, `${thisYear}-10-13T00:00:00`);
  expect(screen.getByText("11 – 13 Oct · 3 days")).toBeInTheDocument();
});

test("a fortnight counts in weeks", () => {
  card(`${thisYear}-10-01T09:00:00`, `${thisYear}-10-14T18:00:00`);
  expect(screen.getByText("1 – 14 Oct · 2 weeks")).toBeInTheDocument();
});
