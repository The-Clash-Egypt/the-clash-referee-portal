import { RefereeTeamAssignResult } from "../features/matches/types/match";

/** Copy shared by the Assign and Bulk Assign Referees drawers. */

/** The server's reason for a team that is playing the match it was asked to referee. */
export const PLAYS_IN_MATCH = "plays in this match";

const count = (n: number, singular: string, plural = `${singular}s`) => `${n} ${n === 1 ? singular : plural}`;

/**
 * "Assign 2 Teams, 1 Referee"; the bulk drawer adds " to 5 Matches". A team only goes to the matches it
 * can referee, so when a picked team doesn't fit every match (`teamsFitEveryMatch` false) the teams get
 * no match count: "Assign 1 Team", or "Assign 1 Team · 2 Referees to 4 Matches".
 */
export const assignButtonLabel = (
  teamCount: number,
  refereeCount: number,
  matchCount?: number,
  teamsFitEveryMatch = true
): string => {
  const teams = teamCount > 0 ? count(teamCount, "Team") : "";
  const referees = refereeCount > 0 ? count(refereeCount, "Referee") : "";
  const picks = `Assign ${[teams, referees].filter(Boolean).join(", ")}`;
  if (matchCount === undefined) return picks;
  const toMatches = ` to ${count(matchCount, "Match", "Matches")}`;
  if (!teams || teamsFitEveryMatch) return `${picks}${toMatches}`;
  return referees ? `Assign ${teams} · ${referees}${toMatches}` : `Assign ${teams}`;
};

/** "1 referee assigned to 2 matches": the bulk outcome's line for the individual referees. */
export const describeRefereeAssignment = (refereeCount: number, matchCount: number): string =>
  `${count(refereeCount, "referee")} assigned to ${count(matchCount, "match", "matches")}`;

/** "Couldn't assign Falcons (plays in this match)." Empty when every team went on. */
export const describeSkippedTeams = (
  results: RefereeTeamAssignResult[],
  teamName: (teamId: string) => string
): string => {
  const skipped = results.flatMap((result) => result.skipped);
  if (skipped.length === 0) return "";
  return `Couldn't assign ${skipped.map((skip) => `${teamName(skip.teamId)} (${skip.reason})`).join(", ")}.`;
};

/**
 * The bulk outcome: "Assigned to 5 matches · skipped 2 (Falcons plays in Falcons vs Sharks; different category ×1)".
 * A team playing a match is named, with the match it plays in, because that is the surprise worth reading;
 * the other reasons are expected across categories, so they are only counted.
 */
export const summarizeTeamAssignment = (
  results: RefereeTeamAssignResult[],
  teamName: (teamId: string) => string,
  matchName: (matchId: string) => string | undefined
): string => {
  const parts = [`Assigned to ${count(results.filter((result) => result.assignedTeamIds.length > 0).length, "match", "matches")}`];

  const unchanged = results.reduce((total, result) => total + result.unchangedTeamIds.length, 0);
  if (unchanged > 0) parts.push(`${unchanged} already assigned`);

  const details: string[] = [];
  const otherReasons = new Map<string, number>();
  let skippedCount = 0;
  results.forEach((result) =>
    result.skipped.forEach((skip) => {
      skippedCount += 1;
      if (skip.reason === PLAYS_IN_MATCH) {
        details.push(`${teamName(skip.teamId)} plays in ${matchName(result.matchId) || "one of the matches"}`);
      } else {
        otherReasons.set(skip.reason, (otherReasons.get(skip.reason) ?? 0) + 1);
      }
    })
  );
  otherReasons.forEach((times, reason) => details.push(`${reason} ×${times}`));
  if (skippedCount > 0) parts.push(`skipped ${skippedCount} (${details.join("; ")})`);

  return parts.join(" · ");
};
