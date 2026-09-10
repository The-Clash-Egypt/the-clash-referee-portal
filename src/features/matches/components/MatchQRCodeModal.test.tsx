import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MatchQRCodeModal, { matchQrFileName } from "./MatchQRCodeModal";
import { issueMatchAccessTokens } from "../api/matchAccess";
import { Match } from "../types/match";

jest.mock("../../../api/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("../api/matchAccess", () => ({
  ...jest.requireActual("../api/matchAccess"),
  issueMatchAccessTokens: jest.fn(),
}));

const issue = issueMatchAccessTokens as jest.Mock;
const match = { id: "m1", homeTeamName: "Falcons", awayTeamName: "Sharks", venue: "Court 1", isCompleted: false } as Match;
const tokenFor = (hour: number, minute: number) => [
  { matchId: "m1", token: "123.abc", expiresAt: new Date(2026, 8, 11, hour, minute).toISOString() },
];

beforeEach(() => issue.mockReset());

afterEach(() => jest.restoreAllMocks());

it("mints a token on open and shows the QR with its expiry", async () => {
  issue.mockResolvedValue(tokenFor(14, 32));

  render(<MatchQRCodeModal match={match} onClose={jest.fn()} />);

  expect(screen.getByText("Generating QR code…")).toBeInTheDocument();
  expect(await screen.findByText("Valid until Fri 11 Sep, 2:32 PM")).toBeInTheDocument();
  expect(screen.getByText(/\/match\/shared\?matchId=m1&token=123\.abc$/)).toBeInTheDocument();
  expect(issue).toHaveBeenCalledWith(["m1"]);
});

it("lets the admin retry when minting fails", async () => {
  const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  const offline = new Error("offline");
  issue.mockRejectedValueOnce(offline).mockResolvedValueOnce(tokenFor(9, 0));

  render(<MatchQRCodeModal match={match} onClose={jest.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Try again" }));

  expect(await screen.findByText(/Valid until/)).toBeInTheDocument();
  expect(issue).toHaveBeenCalledTimes(2);
  expect(errorSpy).toHaveBeenCalledWith("Failed to generate the match QR code:", offline);
});

it("tells the admin a completed match's QR shows the result", async () => {
  issue.mockResolvedValue(tokenFor(9, 0));

  render(<MatchQRCodeModal match={{ ...match, isCompleted: true }} onClose={jest.fn()} />);

  expect(screen.getByText("Scan to view this match's final result.")).toBeInTheDocument();
  await screen.findByText(/Valid until/);
});

describe("matchQrFileName", () => {
  it("keeps team names written in any script", () => {
    expect(matchQrFileName("الصقور", "أسود القاهرة")).toBe("الصقور-vs-أسود-القاهرة-QR");
    expect(matchQrFileName("مُحَمَّد", "Sharks")).toBe("مُحَمَّد-vs-Sharks-QR"); // harakat stay attached
  });

  it("turns spaces and punctuation into single dashes", () => {
    expect(matchQrFileName("Falcons & Co.", "Sharks 2")).toBe("Falcons-Co-vs-Sharks-2-QR");
  });
});
