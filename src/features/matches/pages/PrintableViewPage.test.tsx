import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PrintableViewPage from "./PrintableViewPage";
import { getRefereeMatches } from "../api/matches";
import { issueMatchAccessTokens } from "../api/matchAccess";

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
jest.mock("../../../api/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
// The real module pulls in @react-pdf/renderer, which jsdom can't load.
jest.mock("../../../utils/reactPdfExport", () => ({ previewMatchesPDFWithFilename: jest.fn(() => Promise.resolve()) }));
jest.mock("../api/matches", () => ({ getRefereeMatches: jest.fn() }));
jest.mock("../api/matchAccess", () => ({
  ...jest.requireActual("../api/matchAccess"),
  issueMatchAccessTokens: jest.fn(),
}));

const loadMatches = getRefereeMatches as jest.Mock;
const issueTokens = issueMatchAccessTokens as jest.Mock;

const renderPage = () =>
  render(
    <MemoryRouter
      initialEntries={[
        "/tournaments/t1/matches/preview?tournamentName=Summer%20Open&viewType=venue&venueNames=Court%201&venues=Court%201",
      ]}
    >
      <Routes>
        <Route path="/tournaments/:id/matches/preview" element={<PrintableViewPage />} />
      </Routes>
    </MemoryRouter>
  );

// CRA resets mocks before each test, which would wipe an implementation given in the factory above.
beforeEach(() => {
  loadMatches.mockReset();
  issueTokens.mockResolvedValue([
    { matchId: "m1", token: "tok-m1", expiresAt: new Date(2026, 9, 11, 15, 20).toISOString() },
  ]);
});

it("shows the brand spinner while the matches load", () => {
  loadMatches.mockReturnValue(new Promise(() => undefined));

  renderPage();

  expect(screen.getByRole("status")).toHaveTextContent("Loading matches...");
});

it("explains a failed load and offers the way back", async () => {
  loadMatches.mockRejectedValue(new Error("Request failed with status code 500"));

  renderPage();

  expect(await screen.findByRole("heading", { name: "Error" })).toBeInTheDocument();
  expect(screen.getByText("Request failed with status code 500")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Go Back" })).toBeInTheDocument();
});

it("opens the export preview with its toolbar once the matches are in", async () => {
  loadMatches.mockResolvedValue({
    data: {
      data: {
        matches: {
          items: [
            {
              id: "m1",
              venue: "Court 1",
              startTime: new Date(2026, 9, 10, 15, 20).toISOString(),
              round: "Round 1",
              formatType: "Group",
              bestOf: 3,
              homeTeamName: "Sand Sharks",
              awayTeamName: "Blue Wave",
              isCompleted: false,
            },
          ],
        },
      },
    },
  });

  const errorSpy = jest.spyOn(console, "error");
  renderPage();

  expect(await screen.findByRole("button", { name: "Preview PDF" })).toBeInTheDocument();
  // The QR codes come from one token request for the report, and it succeeds (no failure path, no retry chip).
  await waitFor(() => expect(issueTokens).toHaveBeenCalledWith(["m1"]));
  await waitFor(() => expect(screen.getByRole("button", { name: "Preview PDF" })).toBeEnabled());
  expect(errorSpy).not.toHaveBeenCalledWith("Failed to generate match QR codes:", expect.anything());
  errorSpy.mockRestore();
  expect(screen.getByRole("button", { name: "Close preview" })).toBeInTheDocument();
  expect(screen.getByText("Export preview")).toBeInTheDocument();
  expect(loadMatches).toHaveBeenCalledWith(
    expect.objectContaining({ tournament: "t1", venues: ["Court 1"], pageSize: 1000 })
  );
});
