import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import PrintableView from "./PrintableView";
import { previewMatchesPDFWithFilename } from "../../../utils/reactPdfExport";
import { Match } from "../types/match";

// The real module pulls in @react-pdf/renderer, which jsdom can't load.
jest.mock("../../../utils/reactPdfExport", () => ({ previewMatchesPDFWithFilename: jest.fn(() => Promise.resolve()) }));

const m = (n: number, over: Partial<Match> = {}): Match =>
  ({
    id: `m${n}`,
    venue: "Court 1",
    startTime: new Date(2026, 8, 12, 8 + n).toISOString(),
    round: "Round 1",
    formatType: "Group",
    bestOf: 3,
    homeTeamName: `Home ${n}`,
    awayTeamName: `Away ${n}`,
    isCompleted: false,
    ...over,
  }) as Match;

const links = (matches: Match[]) =>
  Object.fromEntries(
    matches.map((match) => [
      match.id,
      { url: `https://portal.test/match/shared?matchId=${match.id}&token=t`, expiresAt: new Date(2026, 8, 11, 14, 32).toISOString() },
    ])
  );

const view = (matches: Match[], extra: Partial<React.ComponentProps<typeof PrintableView>> = {}) =>
  render(
    <PrintableView
      matches={matches}
      tournamentName="Summer Open"
      viewType="venue"
      onClose={jest.fn()}
      qrLinks={links(matches)}
      qrStatus="ready"
      {...extra}
    />
  );

it("prints four matches per page, one court at a time", () => {
  const { container } = view([1, 2, 3, 4, 5].map((n) => m(n)));

  const pages = container.querySelectorAll(".sheet-page");
  expect(pages).toHaveLength(2);
  expect(pages[0].querySelectorAll(".sheet-card")).toHaveLength(4);
  expect(pages[1].querySelectorAll(".sheet-card")).toHaveLength(1);
  expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
});

it("draws a QR on every card, completed matches included", () => {
  const completed = m(2, {
    isCompleted: true,
    homeScore: 2,
    awayScore: 0,
    gameScores: [
      { gameNumber: 1, homeScore: 21, awayScore: 10 },
      { gameNumber: 2, homeScore: 21, awayScore: 12 },
    ],
  });
  const { container } = view([m(1), completed]);

  expect(container.querySelectorAll(".sheet-card__qr svg")).toHaveLength(2);
  expect(screen.getByText("Scan to view result")).toBeInTheDocument();
  expect(screen.getByText("Final · 2–0")).toBeInTheDocument();
  expect(screen.getAllByText("Valid until Fri 11 Sep, 2:32 PM")).toHaveLength(2);
});

it("keeps printing when QR codes fail, and offers a retry", () => {
  const onRetryQr = jest.fn();
  view([m(1)], { qrLinks: {}, qrStatus: "failed", onRetryQr });

  expect(screen.getByRole("alert")).toHaveTextContent("QR codes couldn't be generated");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(onRetryQr).toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Preview PDF" })).toBeEnabled();
});

it("hands typed scores and the QR links to the PDF", async () => {
  const matches = [m(1)];
  view(matches);

  fireEvent.change(screen.getByLabelText("Home 1 game 1"), { target: { value: "21" } });
  fireEvent.click(screen.getByRole("button", { name: "Preview PDF" }));

  const filters = (previewMatchesPDFWithFilename as jest.Mock).mock.calls[0][3];
  expect(filters.qrLinks).toEqual(links(matches));
  expect(filters.scoreDrafts.m1[0]).toEqual({ gameNumber: 1, home: 21, away: null });
  await screen.findByRole("button", { name: "Preview PDF" }); // let the export state settle
});
