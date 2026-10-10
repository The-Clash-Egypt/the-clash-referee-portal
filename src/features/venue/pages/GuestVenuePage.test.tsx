import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import GuestVenuePage from "./GuestVenuePage";
import { getGuestVenue, validateVenueToken } from "../api/venue";
import { VenueMatch } from "../types/venue";

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
jest.mock("../api/venue", () => ({ getGuestVenue: jest.fn(), validateVenueToken: jest.fn() }));
// The scoreboard is Task 5's; this stub shows what the court page hands it.
jest.mock("../../matches/components/UpdateScoreDialog", () => ({
  __esModule: true,
  default: (props: {
    isOpen: boolean;
    match: { id: string } | null;
    venueAccessToken?: string;
    openInFullscreen?: boolean;
    onClose: () => void;
  }) =>
    props.isOpen ? (
      <div role="dialog" aria-label="Scoreboard">
        <p>{`Scoring ${props.match?.id} with ${props.venueAccessToken}${props.openInFullscreen ? " in full screen" : ""}`}</p>
        <button onClick={props.onClose}>Close stub</button>
      </div>
    ) : null,
}));

const validate = validateVenueToken as jest.Mock;
const loadVenue = getGuestVenue as jest.Mock;

const envelope = <T,>(data: T, message = "") => ({ data: { data, success: true, message, errors: [] } });

// Local times, so the time headers read the same in any timezone.
const at = (hour: number, minute = 0) => new Date(2026, 9, 10, hour, minute).toISOString();

const venueMatch = (over: Partial<VenueMatch>): VenueMatch => ({
  id: "m",
  categoryName: "Men's Open",
  formatName: "Pool A",
  formatType: "Group",
  round: "Round 1",
  startTime: at(12),
  venue: "Court 1",
  homeTeamId: "h",
  homeTeamName: "Home",
  awayTeamId: "a",
  awayTeamName: "Away",
  bestOf: 3,
  winnerTeamId: "",
  homeTeamSets: 0,
  awayTeamSets: 0,
  isCompleted: false,
  gameScores: [],
  homeTeamPlayers: [],
  awayTeamPlayers: [],
  ...over,
});

const MATCHES: VenueMatch[] = [
  venueMatch({
    id: "m1",
    startTime: at(9),
    homeTeamName: "Sand Sharks",
    awayTeamName: "Blue Wave",
    isCompleted: true,
    homeTeamSets: 2,
    awayTeamSets: 0,
    gameScores: [
      { gameNumber: 1, homeScore: 21, awayScore: 18 },
      { gameNumber: 2, homeScore: 21, awayScore: 15 },
    ],
  }),
  venueMatch({ id: "m2", startTime: at(15, 20), homeTeamName: "Dune Dogs", awayTeamName: "Salty Six" }),
  venueMatch({ id: "m3", startTime: at(14), homeTeamName: "Net Ninjas", awayTeamName: "Spike Club" }),
];

const venue = (over: object = {}) => ({
  id: "v1",
  name: "Court 1",
  password: "",
  accessToken: "tok",
  isLocked: false,
  tournamentId: "t1",
  tournamentName: "Summer Clash Open",
  createdAt: "2026-10-01T00:00:00Z",
  matches: MATCHES,
  ...over,
});

const renderPage = (path = "/venue/shared?venueId=v1&token=tok") =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/venue/shared" element={<GuestVenuePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

const rowTexts = (region: HTMLElement) =>
  Array.from(region.querySelectorAll(".match-row")).map((row) => row.textContent ?? "");

beforeEach(() => {
  validate.mockReset();
  loadVenue.mockReset();
});

describe("access", () => {
  it("explains a link without its token, without calling the API", async () => {
    renderPage("/venue/shared?venueId=v1");

    expect(await screen.findByText("Invalid venue link. Please check the URL and try again.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Access Denied" })).toBeInTheDocument();
    expect(validate).not.toHaveBeenCalled();
  });

  it("shows the brand spinner while the link is checked", () => {
    validate.mockReturnValue(new Promise(() => undefined));

    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("Validating access token...");
  });

  it("explains an expired link and offers to try again", async () => {
    validate.mockResolvedValue(envelope(false, "Token has expired"));

    renderPage();

    expect(await screen.findByRole("heading", { name: "Token Expired" })).toBeInTheDocument();
    expect(
      screen.getByText("Your access token has expired. Please contact the venue administrator for a new link.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
    expect(validate).toHaveBeenCalledWith("v1", "tok");
    expect(loadVenue).not.toHaveBeenCalled();
  });

  it("refuses an invalid link", async () => {
    validate.mockResolvedValue(envelope(false, "Invalid token"));

    renderPage();

    expect(await screen.findByRole("heading", { name: "Invalid Token" })).toBeInTheDocument();
    expect(screen.getByText("Invalid token")).toBeInTheDocument();
  });

  it("explains a link that couldn't be checked", async () => {
    validate.mockRejectedValue(new Error("Network Error"));

    renderPage();

    expect(
      await screen.findByText("Failed to validate access token. Please check your connection and try again.")
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Access Denied" })).toBeInTheDocument();
  });

  it("explains a court that couldn't be loaded", async () => {
    validate.mockResolvedValue(envelope(true));
    loadVenue.mockRejectedValue(new Error("Network Error"));

    renderPage();

    expect(await screen.findByText("Failed to load venue information. Please try again.")).toBeInTheDocument();
  });

  it("shows a locked court under its name and tournament, without its matches", async () => {
    validate.mockResolvedValue(envelope(true));
    loadVenue.mockResolvedValue(envelope(venue({ isLocked: true })));

    renderPage();

    expect(await screen.findByRole("heading", { name: "Venue is Currently Locked" })).toBeInTheDocument();
    expect(
      screen.getByText("This venue is currently locked and matches are not available for viewing.")
    ).toBeInTheDocument();
    expect(screen.getByText("Please contact the venue administrator for more information.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Court 1" })).toBeInTheDocument();
    expect(screen.getByText("Summer Clash Open")).toBeInTheDocument();
    expect(document.querySelector(".match-row")).toBeNull();
  });

  it("asks for the court's password, and shows the matches once it is right", async () => {
    validate.mockResolvedValue(envelope(true));
    loadVenue.mockResolvedValue(envelope(venue({ password: "1234" })));

    renderPage();

    expect(await screen.findByRole("heading", { name: "Password Required" })).toBeInTheDocument();
    expect(screen.getByText("This venue requires a password to view matches.")).toBeInTheDocument();
    expect(document.querySelector(".match-row")).toBeNull();

    const field = screen.getByLabelText("Enter venue password");
    expect(field).toHaveAttribute("type", "password");
    fireEvent.change(field, { target: { value: "0000" } });
    fireEvent.click(screen.getByRole("button", { name: "Access Matches" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Incorrect password. Please try again.");
    expect(field).toHaveValue("");

    fireEvent.change(field, { target: { value: " 1234 " } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Access Matches" }));

    expect(await screen.findByRole("region", { name: /Up next/ })).toBeInTheDocument();
  });
});

describe("matches", () => {
  beforeEach(() => {
    validate.mockResolvedValue(envelope(true));
    loadVenue.mockResolvedValue(envelope(venue()));
  });

  it("names the court and its tournament in the bar", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "Court 1" })).toBeInTheDocument();
    expect(screen.getByText("Summer Clash Open")).toBeInTheDocument();
  });

  it("lists the open matches first under their start times, then the finished ones", async () => {
    renderPage();

    const upNext = await screen.findByRole("region", { name: /Up next/ });
    const done = screen.getByRole("region", { name: /Done/ });

    expect(within(upNext).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["14:00", "15:20"]);
    expect(rowTexts(upNext)).toEqual([expect.stringContaining("Net Ninjas"), expect.stringContaining("Dune Dogs")]);
    expect(rowTexts(done)).toEqual([expect.stringContaining("Sand Sharks")]);
    expect(upNext.compareDocumentPosition(done) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("dates the time headers when the court's matches span several days", async () => {
    loadVenue.mockResolvedValue(
      envelope(
        venue({
          matches: [
            venueMatch({ id: "d1", startTime: new Date(2026, 9, 10, 10, 0).toISOString(), homeTeamName: "Day One" }),
            venueMatch({ id: "d2", startTime: new Date(2026, 9, 11, 10, 0).toISOString(), homeTeamName: "Day Two" }),
          ],
        })
      )
    );

    renderPage();

    const upNext = await screen.findByRole("region", { name: /Up next/ });
    expect(within(upNext).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "10:00 Sat 10 Oct",
      "10:00 Sun 11 Oct",
    ]);
  });

  it("opens the scoreboard in full screen with the court's token when an open match is tapped", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Dune Dogs/ }));

    expect(await screen.findByText("Scoring m2 with tok in full screen")).toBeInTheDocument();
  });

  it("refreshes the court when the scoreboard closes", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Net Ninjas/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Close stub" }));

    await waitFor(() => expect(loadVenue).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("dialog", { name: "Scoreboard" })).not.toBeInTheDocument();
  });

  it("does not open the scoreboard for a finished match", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Sand Sharks/ }));

    expect(screen.queryByRole("dialog", { name: "Scoreboard" })).not.toBeInTheDocument();
  });

  it("says so when the court has no matches", async () => {
    loadVenue.mockResolvedValue(envelope(venue({ matches: [] })));

    renderPage();

    expect(await screen.findByRole("heading", { name: "No matches found" })).toBeInTheDocument();
  });
});
