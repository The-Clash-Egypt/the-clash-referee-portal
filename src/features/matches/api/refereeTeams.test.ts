import api from "../../../api/axios";
import { assignRefereeTeams, getRefereeTeamOptions, unassignRefereeTeam } from "./refereeTeams";

jest.mock("../../../api/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const post = api.post as jest.Mock;
const del = api.delete as jest.Mock;

const envelope = <T>(data: T) => ({ data: { data, success: true, message: "" } });

beforeEach(() => {
  post.mockReset();
  del.mockReset();
});

describe("getRefereeTeamOptions", () => {
  it("asks for the teams that can referee the given matches", async () => {
    const options = [{ teamId: "t1", teamName: "Falcons", categoryName: "Men's Open", eligibleMatchIds: ["m1"] }];
    post.mockResolvedValue(envelope(options));

    await expect(getRefereeTeamOptions(["m1", "m2"])).resolves.toEqual(options);
    expect(post).toHaveBeenCalledWith("/Referee/referee-team-options", { matchIds: ["m1", "m2"] });
  });

  it("sends each match once, and nothing at all for an empty list", async () => {
    post.mockResolvedValue(envelope([]));

    await getRefereeTeamOptions(["m1", "m1", "m2"]);
    expect(post).toHaveBeenCalledWith("/Referee/referee-team-options", { matchIds: ["m1", "m2"] });

    post.mockClear();
    await expect(getRefereeTeamOptions([])).resolves.toEqual([]);
    expect(post).not.toHaveBeenCalled();
  });
});

describe("assignRefereeTeams", () => {
  it("assigns every team to every match in one request and returns the per-match outcome", async () => {
    const results = [
      { matchId: "m1", assignedTeamIds: ["t1"], unchangedTeamIds: [], skipped: [{ teamId: "t2", reason: "plays in this match" }] },
    ];
    post.mockResolvedValue(envelope(results));

    await expect(assignRefereeTeams(["t1", "t2"], ["m1"])).resolves.toEqual(results);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("/Referee/referee-teams/assign", { teamIds: ["t1", "t2"], matchIds: ["m1"] });
  });

  it("skips the request when there is nothing to assign", async () => {
    await expect(assignRefereeTeams([], ["m1"])).resolves.toEqual([]);
    await expect(assignRefereeTeams(["t1"], [])).resolves.toEqual([]);
    expect(post).not.toHaveBeenCalled();
  });

  it("passes the server's refusal on to the caller", async () => {
    const refusal = { response: { status: 400, data: { message: "Too many matches" } } };
    post.mockRejectedValue(refusal);

    await expect(assignRefereeTeams(["t1"], ["m1"])).rejects.toBe(refusal);
  });
});

describe("unassignRefereeTeam", () => {
  it("removes one team from one match", async () => {
    del.mockResolvedValue({ data: { message: "Referee team unassigned" } });

    await unassignRefereeTeam("m1", "t1");
    expect(del).toHaveBeenCalledWith("/Referee/matches/m1/referee-teams/t1");
  });

  it("treats a team that is already gone as unassigned", async () => {
    del.mockRejectedValue({ response: { status: 404, data: { message: "Team is not assigned" } } });

    await expect(unassignRefereeTeam("m1", "t1")).resolves.toBeUndefined();
  });

  it("still reports any other failure", async () => {
    const failure = { response: { status: 500, data: {} } };
    del.mockRejectedValue(failure);

    await expect(unassignRefereeTeam("m1", "t1")).rejects.toBe(failure);
  });
});
