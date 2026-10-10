/** The Tournaments home tabs: Live · Upcoming · Past. */
export type TournamentGroup = "active" | "upcoming" | "past";

// Completed tournaments are past. Inactive ones were never listed (they may be unpublished) and still aren't.
const GROUP_OF: Partial<Record<string, TournamentGroup>> = {
  active: "active",
  upcoming: "upcoming",
  past: "past",
  completed: "past",
};

/** The tab a tournament's status puts it in; undefined = not listed. */
export const tournamentGroup = (status: string): TournamentGroup | undefined => GROUP_OF[status];
