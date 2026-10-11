import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import GuestVenuePage from "./GuestVenuePage";
import { openCourt, submitCourtScore } from "../api/venue";
import { GuestCourt, VenueMatch } from "../types/venue";

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
// The page reads refusals with the real courtAccessDenial; only the two requests are faked.
jest.mock("../api/venue", () => ({
  ...jest.requireActual("../api/venue"),
  openCourt: jest.fn(),
  submitCourtScore: jest.fn(),
}));
// The scoreboard is Task 5's; this stub shows what the court page hands it.
jest.mock("../../matches/components/UpdateScoreDialog", () => ({
  __esModule: true,
  default: (props: {
    isOpen: boolean;
    match: { id: string } | null;
    venueAccessToken?: string;
    venuePassword?: string;
    openInFullscreen?: boolean;
    onClose: () => void;
    onSubmit: (gameScores: { gameNumber: number; homeScore: number; awayScore: number }[]) => Promise<void>;
  }) =>
    props.isOpen ? (
      <div role="dialog" aria-label="Scoreboard">
        <p>{`Scoring ${props.match?.id} with ${props.venueAccessToken}${props.openInFullscreen ? " in full screen" : ""}`}</p>
        <p data-testid="live-password">{props.venuePassword ?? "(none)"}</p>
        <button onClick={props.onClose}>Close stub</button>
        {/* The real dialog stays open when onSubmit rejects. */}
        <button onClick={() => props.onSubmit(FINAL).catch(() => undefined)}>Save stub</button>
      </div>
    ) : null,
}));

const loadCourt = openCourt as jest.Mock;
const saveScore = submitCourtScore as jest.Mock;

const FINAL = [
  { gameNumber: 1, homeScore: 21, awayScore: 17 },
  { gameNumber: 2, homeScore: 21, awayScore: 15 },
];

// The API's 403 { success, reason, message, name?, tournamentName? }, as axios rejects with it.
const refusal = (status: number, reason: string, message: string, named = false) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: {
      status,
      data: {
        success: false,
        reason,
        message,
        ...(named ? { name: "Court 1", tournamentName: "Summer Open" } : { name: null, tournamentName: null }),
      },
    },
  });

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

// What POST /venue/{id}/access returns: no password, no token, no lock flag (a locked court is refused).
const court = (over: Partial<GuestCourt> = {}): GuestCourt => ({
  id: "v1",
  name: "Court 1",
  tournamentName: "Summer Clash Open",
  requiresPassword: false,
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
  loadCourt.mockReset();
  saveScore.mockReset();
  jest.spyOn(window, "alert").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("access", () => {
  it("explains a link without its token, without calling the API", async () => {
    renderPage("/venue/shared?venueId=v1");

    expect(await screen.findByText("Invalid venue link. Please check the URL and try again.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Access Denied" })).toBeInTheDocument();
    expect(loadCourt).not.toHaveBeenCalled();
  });

  it("shows the brand spinner while the link is checked", () => {
    loadCourt.mockReturnValue(new Promise(() => undefined));

    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("Validating access token...");
  });

  it("opens the court through the server with the link's token alone", async () => {
    loadCourt.mockResolvedValue(court());

    renderPage();

    expect(await screen.findByRole("region", { name: /Up next/ })).toBeInTheDocument();
    expect(loadCourt).toHaveBeenCalledWith("v1", "tok", undefined);
  });

  it("explains an expired link and offers to try again", async () => {
    loadCourt.mockRejectedValue(refusal(403, "expired", "This court link has expired. Ask the referee desk for a new QR code."));

    renderPage();

    expect(await screen.findByRole("heading", { name: "Token Expired" })).toBeInTheDocument();
    expect(
      screen.getByText("Your access token has expired. Please contact the venue administrator for a new link.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Up next/ })).not.toBeInTheDocument();
  });

  it("refuses an invalid link with the server's explanation", async () => {
    loadCourt.mockRejectedValue(refusal(403, "invalid", "This court link isn't valid."));

    renderPage();

    expect(await screen.findByRole("heading", { name: "Invalid Token" })).toBeInTheDocument();
    expect(screen.getByText("This court link isn't valid.")).toBeInTheDocument();
  });

  it("explains a court that couldn't be loaded", async () => {
    loadCourt.mockRejectedValue(new Error("Network Error"));

    renderPage();

    expect(
      await screen.findByText("Failed to load venue information. Please check your connection and try again.")
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Access Denied" })).toBeInTheDocument();
  });

  it("shows a locked court under its name and tournament, without its matches", async () => {
    loadCourt.mockRejectedValue(refusal(403, "locked", "This court is locked right now.", true));

    renderPage();

    expect(await screen.findByRole("heading", { name: "Venue is Currently Locked" })).toBeInTheDocument();
    expect(
      screen.getByText("This venue is currently locked and matches are not available for viewing.")
    ).toBeInTheDocument();
    expect(screen.getByText("Please contact the venue administrator for more information.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Court 1" })).toBeInTheDocument();
    expect(screen.getByText("Summer Open")).toBeInTheDocument();
    expect(document.querySelector(".match-row")).toBeNull();
  });

  it("asks for the court's password, lets the server check it, and shows the matches once it is right", async () => {
    loadCourt.mockImplementation((_venueId: string, _token: string, password?: string) => {
      if (password === undefined) return Promise.reject(refusal(403, "password-required", "This court needs its password.", true));
      if (password !== "1234") return Promise.reject(refusal(403, "wrong-password", "Incorrect password. Please try again.", true));
      return Promise.resolve(court({ requiresPassword: true }));
    });

    renderPage();

    expect(await screen.findByRole("heading", { name: "Password Required" })).toBeInTheDocument();
    expect(screen.getByText("This venue requires a password to view matches.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Court 1" })).toBeInTheDocument();
    expect(screen.getByText("Summer Open")).toBeInTheDocument();
    expect(document.querySelector(".match-row")).toBeNull();

    const field = screen.getByLabelText("Enter venue password");
    expect(field).toHaveAttribute("type", "password");
    fireEvent.change(field, { target: { value: "0000" } });
    fireEvent.click(screen.getByRole("button", { name: "Access Matches" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect password. Please try again.");
    expect(loadCourt).toHaveBeenLastCalledWith("v1", "tok", "0000");
    expect(screen.getByLabelText("Enter venue password")).toHaveValue("");

    fireEvent.change(screen.getByLabelText("Enter venue password"), { target: { value: " 1234 " } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Access Matches" }));

    expect(await screen.findByRole("region", { name: /Up next/ })).toBeInTheDocument();
    expect(loadCourt).toHaveBeenLastCalledWith("v1", "tok", "1234");
  });

  it("asks again when the same wrong password is sent twice", async () => {
    loadCourt.mockImplementation((_venueId: string, _token: string, password?: string) =>
      Promise.reject(
        password === undefined
          ? refusal(403, "password-required", "This court needs its password.", true)
          : refusal(403, "wrong-password", "Incorrect password. Please try again.", true)
      )
    );

    renderPage();

    for (let attempt = 0; attempt < 2; attempt++) {
      fireEvent.change(await screen.findByLabelText("Enter venue password"), { target: { value: "0000" } });
      fireEvent.click(screen.getByRole("button", { name: "Access Matches" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect password. Please try again.");
    }
    expect(loadCourt).toHaveBeenCalledTimes(3);
  });
});

describe("matches", () => {
  beforeEach(() => {
    loadCourt.mockResolvedValue(court());
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
    loadCourt.mockResolvedValue(
      court({
        matches: [
          venueMatch({ id: "d1", startTime: new Date(2026, 9, 10, 10, 0).toISOString(), homeTeamName: "Day One" }),
          venueMatch({ id: "d2", startTime: new Date(2026, 9, 11, 10, 0).toISOString(), homeTeamName: "Day Two" }),
        ],
      })
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

    await waitFor(() => expect(loadCourt).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("dialog", { name: "Scoreboard" })).not.toBeInTheDocument();
  });

  it("does not open the scoreboard for a finished match", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Sand Sharks/ }));

    expect(screen.queryByRole("dialog", { name: "Scoreboard" })).not.toBeInTheDocument();
  });

  it("says so when the court has no matches", async () => {
    loadCourt.mockResolvedValue(court({ matches: [] }));

    renderPage();

    expect(await screen.findByRole("heading", { name: "No matches found" })).toBeInTheDocument();
  });
});

describe("saving the final score", () => {
  beforeEach(() => {
    loadCourt.mockResolvedValue(court());
  });

  it("saves through the court's score endpoint with the court token, then closes and refreshes", async () => {
    saveScore.mockResolvedValue(true);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Dune Dogs/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Save stub" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Scoreboard" })).not.toBeInTheDocument());
    expect(saveScore).toHaveBeenCalledWith("v1", "m2", { token: "tok", password: undefined }, FINAL);
    await waitFor(() => expect(loadCourt).toHaveBeenCalledTimes(2));
  });

  it("sends the court's password with the final score", async () => {
    loadCourt.mockImplementation((_venueId: string, _token: string, password?: string) =>
      password === "1234"
        ? Promise.resolve(court({ requiresPassword: true }))
        : Promise.reject(refusal(403, "password-required", "This court needs its password.", true))
    );
    saveScore.mockResolvedValue(true);
    renderPage();

    fireEvent.change(await screen.findByLabelText("Enter venue password"), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Access Matches" }));
    fireEvent.click(await screen.findByRole("button", { name: /Dune Dogs/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Save stub" }));

    await waitFor(() => expect(saveScore).toHaveBeenCalledWith("v1", "m2", { token: "tok", password: "1234" }, FINAL));
  });

  it("keeps the scoreboard open and explains a save that failed", async () => {
    saveScore.mockRejectedValue(refusal(400, "rejected", "Games must be numbered 1 to 2 without gaps."));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Dune Dogs/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Save stub" }));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Games must be numbered 1 to 2 without gaps."));
    expect(screen.getByRole("dialog", { name: "Scoreboard" })).toBeInTheDocument();
  });

  it("keeps the scoreboard open on a network failure", async () => {
    saveScore.mockRejectedValue(new Error("Network Error"));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Dune Dogs/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Save stub" }));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Failed to update scores. Please try again."));
    expect(screen.getByRole("dialog", { name: "Scoreboard" })).toBeInTheDocument();
  });

  it("hands the court password to the scoreboard for its live points", async () => {
    loadCourt.mockImplementation((_venueId: string, _token: string, password?: string) =>
      password === "1234"
        ? Promise.resolve(court({ requiresPassword: true }))
        : Promise.reject(refusal(403, "password-required", "This court needs its password.", true))
    );
    renderPage();

    fireEvent.change(await screen.findByLabelText("Enter venue password"), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Access Matches" }));
    fireEvent.click(await screen.findByRole("button", { name: /Dune Dogs/ }));

    expect(await screen.findByTestId("live-password")).toHaveTextContent("1234");
  });

  it("gives the scoreboard no password on a court without one", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Dune Dogs/ }));

    expect(await screen.findByTestId("live-password")).toHaveTextContent("(none)");
  });

  it("never logs the court token or password when a save fails", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    loadCourt.mockImplementation((_venueId: string, _token: string, password?: string) =>
      password === "court-secret"
        ? Promise.resolve(court({ requiresPassword: true }))
        : Promise.reject(refusal(403, "password-required", "This court needs its password.", true))
    );
    saveScore.mockRejectedValue(
      Object.assign(new Error("Network Error"), {
        config: { headers: { "X-Venue-Access-Token": "qr-secret-token", "X-Venue-Password": "court-secret" } },
      })
    );
    renderPage("/venue/shared?venueId=v1&token=qr-secret-token");

    fireEvent.change(await screen.findByLabelText("Enter venue password"), { target: { value: "court-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Access Matches" }));
    fireEvent.click(await screen.findByRole("button", { name: /Dune Dogs/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Save stub" }));

    await waitFor(() => expect(window.alert).toHaveBeenCalled());
    expect(errorSpy).toHaveBeenCalled();
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).not.toContain("court-secret");
    expect(logged).not.toContain("qr-secret-token");
  });

  it.each([
    ["completed", 409, "Scores for this match are final."],
    ["expired", 403, "This court link has expired. Ask the referee desk for a new QR code."],
    ["wrong-court", 403, "This match isn't on this court."],
  ])("closes the scoreboard and refreshes the court when the save is refused as %s", async (reason, status, message) => {
    saveScore.mockRejectedValue(refusal(status, reason, message));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Dune Dogs/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Save stub" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Scoreboard" })).not.toBeInTheDocument());
    await waitFor(() => expect(loadCourt).toHaveBeenCalledTimes(2));
    expect(window.alert).not.toHaveBeenCalled();
  });
});
