import { Match } from "../features/matches/types/match";

/**
 * Formatting shared by the two renderings of the match sheet — the PDF
 * (MatchesPDFDocument) and the HTML preview (PrintableView). Keeping it in one
 * place is what stops the printed document and the on-screen one drifting apart.
 */

/** A match that should have started but has not been marked complete. */
export const matchIsLive = (match: Match): boolean =>
  !match.isCompleted && !!match.startTime && new Date(match.startTime) <= new Date();

export const formatClock = (startTime?: string): string => {
  if (!startTime) return "TBD";
  const date = new Date(startTime);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
};

export const formatDayLabel = (startTime?: string): string => {
  if (!startTime) return "Date to be confirmed";
  const date = new Date(startTime);
  if (Number.isNaN(date.getTime())) return "Date to be confirmed";
  return date.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};

/** Groups consecutive matches onto the same day band. */
export const dayKey = (match: Match): string => {
  if (!match.startTime) return "tbd";
  const date = new Date(match.startTime);
  return Number.isNaN(date.getTime()) ? "tbd" : date.toDateString();
};

export const formatMembers = (members?: Match["homeTeamMembers"]): string => {
  if (!members || members.length === 0) return "";
  return members
    .map((member) => `${member.firstName} ${member.lastName}${member.isCaptain ? " (C)" : ""}`.trim())
    .join(", ");
};

export const formatReferees = (referees?: Match["referees"]): string => {
  if (!referees || referees.length === 0) return "Unassigned";
  return referees.map((referee) => referee.fullName || "Unknown").join(", ");
};

/** Distinct category names across a report, in first-seen order. */
export const distinctCategories = (matches: Match[]): string[] => {
  const seen = new Set<string>();
  matches.forEach((match) => {
    const category = match.categoryName?.trim();
    if (category) seen.add(category);
  });
  return Array.from(seen);
};

/**
 * A match only needs its own category label when the report spans more than one.
 * With a single category the sheet header carries it, and repeating it on every
 * row would just be noise.
 */
export const shouldLabelCategories = (matches: Match[]): boolean =>
  distinctCategories(matches).length > 1;

/**
 * The category for the sheet header: the filtered one if a filter is applied,
 * otherwise the report's only category — so it is always stated exactly once,
 * either in the header or on each row.
 */
export const headerCategory = (categoryName: string | undefined, matches: Match[]): string | undefined => {
  if (categoryName) return categoryName;
  const categories = distinctCategories(matches);
  return categories.length === 1 ? categories[0] : undefined;
};

export const matchCountLabel = (total: number): string =>
  `${total} ${total === 1 ? "match" : "matches"}`;

export const printedOnLabel = (): string =>
  `Printed ${new Date().toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}`;

/** The meta items under the sheet title: tournament, category, format, match count. */
export const sheetMeta = (
  tournamentName: string,
  categoryName: string | undefined,
  formatName: string | undefined,
  matchCount: number
): string[] =>
  [tournamentName, categoryName, formatName].filter(Boolean).concat(matchCountLabel(matchCount)) as string[];
