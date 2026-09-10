import { RefereeTeamAssignResult } from "../features/matches/types/match";
import { assignButtonLabel, describeSkippedTeams, summarizeTeamAssignment } from "./refereeAssignText";

const names: Record<string, string> = { t1: "Falcons", t2: "Sharks", t3: "Eagles" };
const teamName = (teamId: string) => names[teamId] ?? "Unknown team";

const result = (matchId: string, over: Partial<RefereeTeamAssignResult> = {}): RefereeTeamAssignResult => ({
  matchId,
  assignedTeamIds: [],
  unchangedTeamIds: [],
  skipped: [],
  ...over,
});

describe("assignButtonLabel", () => {
  it("keeps the referee-only wording the drawers always had", () => {
    expect(assignButtonLabel(0, 1)).toBe("Assign 1 Referee");
    expect(assignButtonLabel(0, 3)).toBe("Assign 3 Referees");
    expect(assignButtonLabel(0, 2, 1)).toBe("Assign 2 Referees to 1 Match");
    expect(assignButtonLabel(0, 1, 4)).toBe("Assign 1 Referee to 4 Matches");
  });

  it("counts picked teams first, then referees", () => {
    expect(assignButtonLabel(1, 0)).toBe("Assign 1 Team");
    expect(assignButtonLabel(2, 1)).toBe("Assign 2 Teams, 1 Referee");
    expect(assignButtonLabel(2, 0, 5)).toBe("Assign 2 Teams to 5 Matches");
    expect(assignButtonLabel(1, 2, 3)).toBe("Assign 1 Team, 2 Referees to 3 Matches");
  });
});

describe("describeSkippedTeams", () => {
  it("is empty when every team went on", () => {
    expect(describeSkippedTeams([result("m1", { assignedTeamIds: ["t1"] })], teamName)).toBe("");
    expect(describeSkippedTeams([], teamName)).toBe("");
  });

  it("names each skipped team with the server's reason", () => {
    const results = [
      result("m1", {
        assignedTeamIds: ["t3"],
        skipped: [
          { teamId: "t1", reason: "plays in this match" },
          { teamId: "t2", reason: "different category" },
        ],
      }),
    ];
    expect(describeSkippedTeams(results, teamName)).toBe(
      "Couldn't assign Falcons (plays in this match), Sharks (different category)."
    );
  });
});

describe("summarizeTeamAssignment", () => {
  const matchNumber = (matchId: string) => ({ m1: 1, m2: 2, m3: 3, m4: 4, m5: 5, m6: 6 } as Record<string, number>)[matchId];

  it("counts the matches that gained a team", () => {
    const results = ["m1", "m2", "m3"].map((id) => result(id, { assignedTeamIds: ["t1", "t2"] }));
    expect(summarizeTeamAssignment(results, teamName, matchNumber)).toBe("Assigned to 3 matches");
    expect(summarizeTeamAssignment([result("m1", { assignedTeamIds: ["t1"] })], teamName, matchNumber)).toBe(
      "Assigned to 1 match"
    );
  });

  it("names a team that plays in the match and counts the other skips by reason", () => {
    const results = [
      result("m1", { assignedTeamIds: ["t2"] }),
      result("m2", { assignedTeamIds: ["t2"] }),
      result("m3", { skipped: [{ teamId: "t1", reason: "plays in this match" }] }),
      result("m4", { assignedTeamIds: ["t1"], skipped: [{ teamId: "t2", reason: "different category" }] }),
      result("m5", { assignedTeamIds: ["t1"] }),
      result("m6", { assignedTeamIds: ["t1", "t2"] }),
    ];
    expect(summarizeTeamAssignment(results, teamName, matchNumber)).toBe(
      "Assigned to 5 matches · skipped 2 (Falcons plays in match #3; different category ×1)"
    );
  });

  it("mentions pairs that were already in place", () => {
    const results = [result("m1", { assignedTeamIds: ["t1"], unchangedTeamIds: ["t2"] }), result("m2", { unchangedTeamIds: ["t2"] })];
    expect(summarizeTeamAssignment(results, teamName, matchNumber)).toBe("Assigned to 1 match · 2 already assigned");
  });

  it("still reads when nothing could be assigned", () => {
    const results = [
      result("m1", { skipped: [{ teamId: "t1", reason: "different category" }] }),
      result("m2", { skipped: [{ teamId: "t1", reason: "different category" }, { teamId: "t3", reason: "not a real team" }] }),
      result("x9", { skipped: [{ teamId: "t2", reason: "plays in this match" }] }),
    ];
    expect(summarizeTeamAssignment(results, teamName, matchNumber)).toBe(
      "Assigned to 0 matches · skipped 4 (Sharks plays in one of the matches; different category ×2; not a real team ×1)"
    );
  });
});
