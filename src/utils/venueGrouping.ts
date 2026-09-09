import { Match } from "../features/matches/types/match";

export const UNASSIGNED_VENUE_LABEL = "Venue to be confirmed";

export interface VenueGroup {
  /** Venue name, or UNASSIGNED_VENUE_LABEL for matches with no venue set. */
  venue: string;
  matches: Match[];
}

/** Natural ordering so Court 2 sorts before Court 10, matching the venue filter list. */
export const compareVenueNames = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

const startTimeOf = (match: Match): number => {
  const parsed = match.startTime ? new Date(match.startTime).getTime() : NaN;
  // Matches without a start time sort last rather than jumping to the top.
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
};

/**
 * Splits matches into one group per venue, ordered naturally by venue name, with
 * matches inside each group in chronological order. Matches with no venue are
 * collected into a single trailing group.
 */
export const groupMatchesByVenue = (matches: Match[]): VenueGroup[] => {
  const groups = new Map<string, Match[]>();

  matches.forEach((match) => {
    const venue = match.venue?.trim() || UNASSIGNED_VENUE_LABEL;
    const existing = groups.get(venue);
    if (existing) {
      existing.push(match);
    } else {
      groups.set(venue, [match]);
    }
  });

  return Array.from(groups.entries())
    .map(([venue, venueMatches]) => ({
      venue,
      matches: [...venueMatches].sort((a, b) => startTimeOf(a) - startTimeOf(b)),
    }))
    .sort((a, b) => {
      if (a.venue === UNASSIGNED_VENUE_LABEL) return 1;
      if (b.venue === UNASSIGNED_VENUE_LABEL) return -1;
      return compareVenueNames(a.venue, b.venue);
    });
};

/** Venue reports read as a court sheet; referee and team reports stay chronological. */
export const shouldGroupByVenue = (viewType: string): boolean =>
  viewType === "venue" || viewType === "general";
