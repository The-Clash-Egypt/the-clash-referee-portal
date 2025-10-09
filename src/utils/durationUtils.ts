import { Match } from "../features/matches/types/match";

/**
 * Calculate the duration between two timestamps in a human-readable format
 * @param startTime - Start timestamp (ISO string or Date)
 * @param endTime - End timestamp (ISO string or Date)
 * @returns Formatted duration string (e.g., "2h 30m", "45m", "1d 3h")
 */
export const calculateDuration = (startTime: string | Date, endTime: string | Date): string => {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return "Invalid time";
  }

  const diffMs = end.getTime() - start.getTime();

  if (diffMs < 0) {
    return "Invalid duration";
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  const remainingHours = diffHours % 24;
  const remainingMinutes = diffMinutes % 60;

  const parts: string[] = [];

  if (diffDays > 0) {
    parts.push(`${diffDays}d`);
  }
  if (remainingHours > 0) {
    parts.push(`${remainingHours}h`);
  }
  if (remainingMinutes > 0) {
    parts.push(`${remainingMinutes}m`);
  }

  return parts.length > 0 ? parts.join(" ") : "0m";
};

/**
 * Calculate match duration if both startedAt and endedAt are available
 * @param match - Match object with potential startedAt and endedAt fields
 * @returns Duration string or null if either field is missing
 */
export const getMatchDuration = (match: Match): string | null => {
  if (!match.startedAt || !match.endedAt) {
    return null;
  }

  return calculateDuration(match.startedAt, match.endedAt);
};

/**
 * Calculate the duration of a tournament day based on matches
 * @param matches - Array of matches for a specific day
 * @returns Duration string or null if no valid matches
 */
export const getTournamentDayDuration = (matches: Match[]): string | null => {
  if (!matches || matches.length === 0) {
    return null;
  }

  // Filter matches that have both startedAt and endedAt
  const completedMatches = matches.filter((match) => match.startedAt && match.endedAt);

  if (completedMatches.length === 0) {
    return null;
  }

  // Find the earliest start time and latest end time
  const startTimes = completedMatches.map((match) => new Date(match.startedAt!));
  const endTimes = completedMatches.map((match) => new Date(match.endedAt!));

  const earliestStart = new Date(Math.min(...startTimes.map((d) => d.getTime())));
  const latestEnd = new Date(Math.max(...endTimes.map((d) => d.getTime())));

  return calculateDuration(earliestStart, latestEnd);
};

/**
 * Get the start and end times for a tournament day
 * @param matches - Array of matches for a specific day
 * @returns Object with start and end times or null if no valid matches
 */
export const getTournamentDayTimeRange = (matches: Match[]): { start: Date; end: Date } | null => {
  if (!matches || matches.length === 0) {
    return null;
  }

  // Filter matches that have both startedAt and endedAt
  const completedMatches = matches.filter((match) => match.startedAt && match.endedAt);

  if (completedMatches.length === 0) {
    return null;
  }

  // Find the earliest start time and latest end time
  const startTimes = completedMatches.map((match) => new Date(match.startedAt!));
  const endTimes = completedMatches.map((match) => new Date(match.endedAt!));

  const earliestStart = new Date(Math.min(...startTimes.map((d) => d.getTime())));
  const latestEnd = new Date(Math.max(...endTimes.map((d) => d.getTime())));

  return { start: earliestStart, end: latestEnd };
};

/**
 * Group matches by day for duration calculation
 * @param matches - Array of matches
 * @returns Object with dates as keys and matches as values
 */
export const groupMatchesByDay = (matches: Match[]): { [date: string]: Match[] } => {
  const grouped: { [date: string]: Match[] } = {};

  matches.forEach((match) => {
    if (match.startedAt) {
      const date = new Date(match.startedAt).toDateString();
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(match);
    }
  });

  return grouped;
};
