import { RefereeTeamAssignResult } from "../features/matches/types/match";
import {
  assignButtonLabel,
  describeRefereeAssignment,
  describeSkippedTeams,
  summarizeTeamAssignment,
} from "./refereeAssignText";

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

  it("promises every match to the teams only when each picked team fits them all", () => {
    expect(assignButtonLabel(2, 0, 5, true)).toBe("Assign 2 Teams to 5 Matches");
    expect(assignButtonLabel(1, 0, 4, false)).toBe("Assign 1 Team");
    expect(assignButtonLabel(2, 0, 4, false)).toBe("Assign 2 Teams");
    // The referees still go to every match.
    expect(assignButtonLabel(1, 2, 4, false)).toBe("Assign 1 Team · 2 Referees to 4 Matches");
    expect(assignButtonLabel(0, 2, 4, false)).toBe("Assign 2 Referees to 4 Matches");
  });
});

describe("describeRefereeAssignment", () => {
  it("counts the referees and the matches they went to", () => {
    expect(describeRefereeAssignment(1, 2)).toBe("1 referee assigned to 2 matches");
    expect(describeRefereeAssignment(3, 1)).toBe("3 referees assigned to 1 match");
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
  const matchName = (matchId: string) =>
    ({ m1: "Falcons vs Sharks", m2: "Eagles vs Tigers", m3: "Falcons vs Eagles", m4: "Sharks vs Tigers", m5: "Waves vs Dunes", m6: "Pearls vs Corals" } as Record<string, string>)[matchId];

  it("counts the matches that gained a team", () => {
    const results = ["m1", "m2", "m3"].map((id) => result(id, { assignedTeamIds: ["t1", "t2"] }));
    expect(summarizeTeamAssignment(results, teamName, matchName)).toBe("Assigned to 3 matches");
    expect(summarizeTeamAssignment([result("m1", { assignedTeamIds: ["t1"] })], teamName, matchName)).toBe(
      "Assigned to 1 match"
    );
  });

  it("names the match a team plays in and counts the other skips by reason", () => {
    const results = [
      result("m1", { assignedTeamIds: ["t2"] }),
      result("m2", { assignedTeamIds: ["t2"] }),
      result("m3", { skipped: [{ teamId: "t1", reason: "plays in this match" }] }),
      result("m4", { assignedTeamIds: ["t1"], skipped: [{ teamId: "t2", reason: "different category" }] }),
      result("m5", { assignedTeamIds: ["t1"] }),
      result("m6", { assignedTeamIds: ["t1", "t2"] }),
    ];
    expect(summarizeTeamAssignment(results, teamName, matchName)).toBe(
      "Assigned to 5 matches · skipped 2 (Falcons plays in Falcons vs Eagles; different category ×1)"
    );
  });

  it("mentions pairs that were already in place", () => {
    const results = [result("m1", { assignedTeamIds: ["t1"], unchangedTeamIds: ["t2"] }), result("m2", { unchangedTeamIds: ["t2"] })];
    expect(summarizeTeamAssignment(results, teamName, matchName)).toBe("Assigned to 1 match · 2 already assigned");
  });

  it("still reads when nothing could be assigned", () => {
    const results = [
      result("m1", { skipped: [{ teamId: "t1", reason: "different category" }] }),
      result("m2", { skipped: [{ teamId: "t1", reason: "different category" }, { teamId: "t3", reason: "not a real team" }] }),
      result("x9", { skipped: [{ teamId: "t2", reason: "plays in this match" }] }),
    ];
    expect(summarizeTeamAssignment(results, teamName, matchName)).toBe(
      "Assigned to 0 matches · skipped 4 (Sharks plays in one of the matches; different category ×2; not a real team ×1)"
    );
  });
});
