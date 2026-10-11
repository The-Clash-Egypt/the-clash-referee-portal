import api from "../../../api/axios";
import {
  COURT_PASSWORD_HEADER,
  COURT_TOKEN_HEADER,
  courtAccessDenial,
  openCourt,
  submitCourtScore,
} from "./venue";
import { GuestCourt } from "../types/venue";

jest.mock("../../../api/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const http = api as unknown as { get: jest.Mock; post: jest.Mock; put: jest.Mock };

const court: GuestCourt = {
  id: "v1",
  name: "Court 1",
  tournamentName: "Summer Open",
  requiresPassword: false,
  matches: [],
};

const httpError = (status: number, data?: object) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });

beforeEach(() => {
  http.get.mockReset();
  http.post.mockReset();
  http.put.mockReset();
});

describe("openCourt", () => {
  it("asks the server to open the court with its QR token, never reading the court directly", async () => {
    http.post.mockResolvedValue({ data: { data: court, success: true, message: "" } });

    await expect(openCourt("v1", "tok")).resolves.toEqual(court);

    expect(http.post).toHaveBeenCalledWith("/venue/v1/access", { token: "tok" });
    expect(http.get).not.toHaveBeenCalled();
  });

  it("sends the password the guest typed, for the server to check", async () => {
    http.post.mockResolvedValue({ data: { data: { ...court, requiresPassword: true }, success: true, message: "" } });

    await openCourt("v1", "tok", "1234");

    expect(http.post).toHaveBeenCalledWith("/venue/v1/access", { token: "tok", password: "1234" });
  });

  it("encodes the court id from the link before it goes into the path", async () => {
    http.post.mockResolvedValue({ data: { data: court, success: true, message: "" } });

    await openCourt("v1/../x", "tok");

    expect(http.post).toHaveBeenCalledWith("/venue/v1%2F..%2Fx/access", { token: "tok" });
  });
});

describe("submitCourtScore", () => {
  const scores = [{ gameNumber: 1, homeScore: 21, awayScore: 17 }];

  it("saves the final score through the court's own endpoint with the court token", async () => {
    http.put.mockResolvedValue({ data: { data: true, success: true, message: "" } });

    await submitCourtScore("v1", "m1", { token: "tok" }, scores);

    expect(http.put).toHaveBeenCalledWith(
      "/venue/v1/matches/m1/score",
      { gameScores: scores },
      { headers: { [COURT_TOKEN_HEADER]: "tok" } }
    );
  });

  it("adds the court password, URI-encoded so any character fits in a header", async () => {
    http.put.mockResolvedValue({ data: { data: true, success: true, message: "" } });

    await submitCourtScore("v1", "m1", { token: "tok", password: "كلمة سر" }, scores);

    expect(http.put).toHaveBeenCalledWith(
      "/venue/v1/matches/m1/score",
      { gameScores: scores },
      { headers: { [COURT_TOKEN_HEADER]: "tok", [COURT_PASSWORD_HEADER]: encodeURIComponent("كلمة سر") } }
    );
  });

  it("uses the header names the API reads", () => {
    expect(COURT_TOKEN_HEADER).toBe("X-Venue-Access-Token");
    expect(COURT_PASSWORD_HEADER).toBe("X-Venue-Password");
  });
});

describe("courtAccessDenial", () => {
  it.each(["invalid", "expired", "locked", "password-required", "wrong-password", "wrong-court", "completed"])(
    "reads the server's %s refusal",
    (reason) => {
      const denial = courtAccessDenial(
        httpError(403, { success: false, reason, message: "Nope.", name: "Court 1", tournamentName: "Summer Open" })
      );

      expect(denial).toEqual({ reason, message: "Nope.", name: "Court 1", tournamentName: "Summer Open" });
    }
  );

  it("is null for a network failure or a server error without a reason", () => {
    expect(courtAccessDenial(new Error("Network Error"))).toBeNull();
    expect(courtAccessDenial(httpError(500, { message: "boom" }))).toBeNull();
  });
});
