import api from "../../../api/axios";
import {
  GuestMatch,
  MATCH_ACCESS_HEADER,
  buildMatchAccessUrl,
  getGuestMatch,
  guestAccessErrorReason,
  guestMatchToMatch,
  isMatchId,
  issueMatchAccessTokens,
  submitGuestMatchScore,
} from "./matchAccess";

jest.mock("../../../api/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const http = api as unknown as { get: jest.Mock; post: jest.Mock; put: jest.Mock };

const guest = (over: Partial<GuestMatch> = {}): GuestMatch => ({
  id: "m1",
  tournamentName: "Summer Open",
  categoryName: "Men's Open",
  formatName: "Pool A",
  formatType: "Group",
  round: "Round 1",
  venue: "Court 1",
  startTime: "2026-09-12T10:30:00Z",
  bestOf: 3,
  pointsPerMatch: null,
  pointsForDraw: 1,
  isCompleted: false,
  homeTeamName: "Falcons",
  awayTeamName: "Sharks",
  homeTeam2Name: null,
  awayTeam2Name: null,
  homeTeamSets: 1,
  awayTeamSets: 0,
  gameScores: [{ gameNumber: 1, homeScore: 21, awayScore: 17 }],
  homeTeamPlayers: [{ firstName: "Aly", lastName: "Hassan", isCaptain: true }],
  awayTeamPlayers: [],
  expiresAt: "2026-09-11T12:00:00Z",
  ...over,
});

beforeEach(() => jest.clearAllMocks());

describe("buildMatchAccessUrl", () => {
  it("builds the guest link and encodes the token", () => {
    expect(buildMatchAccessUrl("m-1", "1789.ab+c/d", "https://portal.test")).toBe(
      "https://portal.test/match/shared?matchId=m-1&token=1789.ab%2Bc%2Fd"
    );
  });
});

describe("issueMatchAccessTokens", () => {
  it("de-duplicates and sends at most 1000 ids per request", async () => {
    http.post.mockImplementation((_url: string, body: { matchIds: string[] }) =>
      Promise.resolve({
        data: { data: body.matchIds.map((id) => ({ matchId: id, token: `t-${id}`, expiresAt: "2026-09-11T12:00:00Z" })) },
      })
    );
    const ids = Array.from({ length: 2500 }, (_, index) => `m${index}`);

    const tokens = await issueMatchAccessTokens([...ids, "m0"]);

    expect(http.post).toHaveBeenCalledTimes(3);
    expect(http.post).toHaveBeenNthCalledWith(1, "/MatchAccess/tokens", { matchIds: ids.slice(0, 1000) });
    expect(tokens).toHaveLength(2500);
  });

  it("makes no request for an empty list", async () => {
    expect(await issueMatchAccessTokens([])).toEqual([]);
    expect(http.post).not.toHaveBeenCalled();
  });
});

describe("guest calls", () => {
  it("loads the match with the token in the match-access header", async () => {
    http.get.mockResolvedValue({ data: { data: guest() } });

    expect((await getGuestMatch("m1", "tok")).id).toBe("m1");
    expect(http.get).toHaveBeenCalledWith("/MatchAccess/m1", { headers: { [MATCH_ACCESS_HEADER]: "tok" } });
  });

  it("submits scores with the same header", async () => {
    http.put.mockResolvedValue({ data: { data: guest({ isCompleted: true }) } });
    const scores = [{ gameNumber: 1, homeScore: 21, awayScore: 17 }];

    expect((await submitGuestMatchScore("m1", "tok", scores)).isCompleted).toBe(true);
    expect(http.put).toHaveBeenCalledWith(
      "/MatchAccess/m1/score",
      { gameScores: scores },
      { headers: { [MATCH_ACCESS_HEADER]: "tok" } }
    );
  });

  it("encodes the match id before putting it in the path", async () => {
    http.get.mockResolvedValue({ data: { data: guest() } });
    http.put.mockResolvedValue({ data: { data: guest() } });

    await getGuestMatch("../tokens?x=1", "tok");
    await submitGuestMatchScore("a/b", "tok", []);

    expect(http.get).toHaveBeenCalledWith("/MatchAccess/..%2Ftokens%3Fx%3D1", expect.anything());
    expect(http.put).toHaveBeenCalledWith("/MatchAccess/a%2Fb/score", { gameScores: [] }, expect.anything());
  });
});

describe("isMatchId", () => {
  it("accepts a GUID in either case, and nothing else", () => {
    expect(isMatchId("3f2c8a1e-9b4d-4c6e-8f1a-2b3c4d5e6f70")).toBe(true);
    expect(isMatchId("3F2C8A1E-9B4D-4C6E-8F1A-2B3C4D5E6F70")).toBe(true);
    expect(isMatchId("m1")).toBe(false);
    expect(isMatchId("../tokens")).toBe(false);
    expect(isMatchId(" 3f2c8a1e-9b4d-4c6e-8f1a-2b3c4d5e6f70")).toBe(false);
    expect(isMatchId("")).toBe(false);
  });
});

describe("guestAccessErrorReason", () => {
  const failure = (status: number, reason?: string) => ({ response: { status, data: reason ? { reason } : {} } });

  it.each([
    [failure(403, "expired"), "expired"],
    [failure(403, "invalid"), "invalid"],
    [failure(409, "completed"), "completed"],
    [failure(404), "not-found"],
    [failure(403), "invalid"],
    [failure(500), "unknown"],
    [new Error("socket hang up"), "network"],
  ])("maps %p to %s", (error, reason) => {
    expect(guestAccessErrorReason(error)).toBe(reason);
  });
});

describe("guestMatchToMatch", () => {
  it("carries names, sets and score rules into a portal Match", () => {
    const match = guestMatchToMatch(guest());

    expect(match).toMatchObject({
      id: "m1",
      homeTeamName: "Falcons",
      awayTeamName: "Sharks",
      homeScore: 1,
      awayScore: 0,
      bestOf: 3,
      pointsForDraw: 1,
      formatType: "Group",
      format: "Pool A",
      venue: "Court 1",
      isCompleted: false,
    });
    expect(match.homeTeamMembers?.[0]).toMatchObject({ firstName: "Aly", lastName: "Hassan", isCaptain: true });
  });

  it("carries the referee team names, in order, under ids of its own", () => {
    expect(guestMatchToMatch(guest({ refereeTeamNames: ["Eagles", "Waves"] })).refereeTeams).toEqual([
      { teamId: "guest-referee-team-0", teamName: "Eagles" },
      { teamId: "guest-referee-team-1", teamName: "Waves" },
    ]);
  });

  it("reads a backend that doesn't send referee teams as none", () => {
    expect(guestMatchToMatch(guest()).refereeTeams).toEqual([]);
  });
});
