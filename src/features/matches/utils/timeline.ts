import { Match } from "../types/match";

/** The matches screen's tabs: Live · Up next · Done. */
export type MatchTab = "live" | "next" | "done";

/** The API `status` behind each tab (live = not completed and started by its start time; next = starts later). */
export const TAB_STATUS: Record<MatchTab, "in-progress" | "upcoming" | "completed"> = {
  live: "in-progress",
  next: "upcoming",
  done: "completed",
};

/** Being played right now: a referee started it and it isn't finished. (The Live tab also lists matches due to start.) */
export const isLive = (m: Match): boolean => !!m.startedAt && !m.isCompleted;

export interface TimelineGroup {
  /** The local start minute ("2026-10-12T15:20"), or "none". */
  key: string;
  /** "15:20", or "No time". */
  label: string;
  /** "Sat 12 Oct", on the first slot of each day when dates are shown. */
  dateLabel?: string;
  matches: Match[];
}

const NO_TIME_KEY = "none";

interface LocalParts {
  day: string; // 2026-10-12
  time: string; // 15:20
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

/** The calendar day and the 24h time of an instant, in `timeZone` (default: the device's). */
const localParts = (date: Date, timeZone?: string): LocalParts => {
  const cacheKey = timeZone ?? "";
  let format = partsFormatters.get(cacheKey);
  if (!format) {
    format = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    partsFormatters.set(cacheKey, format);
  }
  const parts = format.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
};

/** Parses a start time; null when missing or unreadable. */
const startOf = (m: Match): number | null => {
  if (!m.startTime) return null;
  const at = Date.parse(m.startTime);
  return Number.isNaN(at) ? null : at;
};

/** Natural court order (Court 2 before Court 10); a match without a court goes after the others. */
export const compareCourts = (a?: string | null, b?: string | null): number => {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, undefined, { numeric: true });
};

/** "Sat 12 Oct" (the day of a "yyyy-mm-dd" key, read as a calendar day). */
const dayLabelOfKey = (dayKey: string): string => {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(year, month - 1, day)
  );
};

/**
 * The timeline's time slots: matches grouped by their local start minute, slots in time order (newest first when
 * `descending`), each slot's courts in natural order. Matches without a start time go last, under "No time". With
 * `showDates` the first slot of each day carries the day ("Sat 12 Oct").
 */
export function groupMatchesBySlot(
  matches: Match[],
  opts: { showDates: boolean; descending: boolean; timeZone?: string }
): TimelineGroup[] {
  const timed: { match: Match; at: number; index: number }[] = [];
  const untimed: Match[] = [];
  matches.forEach((match, index) => {
    const at = startOf(match);
    if (at === null) untimed.push(match);
    else timed.push({ match, at, index });
  });

  timed.sort((a, b) => a.at - b.at || a.index - b.index);

  const groups: (TimelineGroup & { day: string })[] = [];
  const byKey = new Map<string, TimelineGroup & { day: string }>();
  timed.forEach(({ match, at }) => {
    const { day, time } = localParts(new Date(at), opts.timeZone);
    const key = `${day}T${time}`;
    let group = byKey.get(key);
    if (!group) {
      group = { key, label: time, day, matches: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.matches.push(match);
  });

  if (opts.descending) groups.reverse();

  let previousDay: string | null = null;
  const result: TimelineGroup[] = groups.map(({ day, ...group }) => {
    const slot: TimelineGroup = { ...group, matches: sortByCourt(group.matches) };
    if (opts.showDates && day !== previousDay) slot.dateLabel = dayLabelOfKey(day);
    previousDay = day;
    return slot;
  });

  if (untimed.length > 0) {
    result.push({ key: NO_TIME_KEY, label: "No time", matches: sortByCourt(opts.descending ? untimed.slice().reverse() : untimed) });
  }
  return result;
}

/** Stable sort by court (natural order). */
export const sortByCourt = (matches: Match[]): Match[] =>
  matches
    .map((match, index) => ({ match, index }))
    .sort((a, b) => compareCourts(a.match.venue, b.match.venue) || a.index - b.index)
    .map(({ match }) => match);

/**
 * The Live tab: one "Now" group, court by court. The server keeps a match in progress from its start time until it is
 * completed, so with every day shown (`showDates`) Live can also hold matches from earlier days that were never closed:
 * those follow under their own day and time, newest first, so they don't read as being played now.
 */
export function groupLiveMatches(
  matches: Match[],
  opts: { showDates: boolean; now?: Date; timeZone?: string }
): TimelineGroup[] {
  const today = localParts(opts.now ?? new Date(), opts.timeZone).day;
  const current: Match[] = [];
  const earlier: Match[] = [];
  matches.forEach((match) => {
    const at = startOf(match);
    const before = opts.showDates && at !== null && localParts(new Date(at), opts.timeZone).day < today;
    (before ? earlier : current).push(match);
  });
  const groups: TimelineGroup[] = current.length > 0 ? [{ key: "now", label: "Now", matches: sortByCourt(current) }] : [];
  return groups.concat(groupMatchesBySlot(earlier, { showDates: true, descending: true, timeZone: opts.timeZone }));
}

/** The tab a tournament opens on: Live while anything is live, else Up next. */
export function defaultTab(counts: { live: number; next: number; done: number }): MatchTab {
  return counts.live > 0 ? "live" : "next";
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The local calendar day ("yyyy-mm-dd") of a date filter entry: a plain date as is, a date-time in local time. */
const localDayOfEntry = (entry: string): string | null => {
  if (DATE_ONLY.test(entry)) return entry;
  const at = Date.parse(entry);
  if (Number.isNaN(at)) return null;
  return localParts(new Date(at)).day;
};

/** The Day filter a tournament opens on: today's entry when it has matches today, else "all". */
export function defaultDate(dates: string[], today: Date): string {
  const todayKey = localParts(today).day;
  return dates.find((entry) => localDayOfEntry(entry) === todayKey) ?? "all";
}

/**
 * The pages to request for the Done tab, newest first. The server lists oldest first, so Done starts from the last
 * page: (65, 30) => [3, 2, 1]; nothing done => [].
 */
export function doneRequestPages(total: number, pageSize: number): number[] {
  const pages = total > 0 && pageSize > 0 ? Math.ceil(total / pageSize) : 0;
  return Array.from({ length: pages }, (_, i) => pages - i);
}

/** A court's short name for the timeline: "Court 1" => "C1", "Centre Court" => "Centre", none => "—". See courtLabels. */
export function courtShort(venue?: string | null): string {
  const name = (venue ?? "").trim();
  if (!name) return "—";
  const numbered = /\bcourt\s*#?\s*(\d+[a-z]?)\b/i.exec(name);
  if (numbered) return `C${numbered[1].toUpperCase()}`;
  const lettered = /^court\s+([a-z0-9]{1,3})$/i.exec(name);
  if (lettered) return `C${lettered[1].toUpperCase()}`;
  const withoutCourt = name.replace(/\bcourt\b/i, " ").replace(/\s+/g, " ").trim();
  return (withoutCourt || name).split(" ")[0];
}

/**
 * The timeline's court labels for a tournament's courts: the short name, unless two of the courts would read the same
 * ("Court 1" and "Beach Court 1" are both "C1"): those keep their full names.
 */
export function courtLabels(venues: (string | null | undefined)[]): (venue?: string | null) => string {
  const namesByShort = new Map<string, Set<string>>();
  venues.forEach((venue) => {
    const name = (venue ?? "").trim();
    if (!name) return;
    const short = courtShort(name);
    namesByShort.set(short, (namesByShort.get(short) ?? new Set<string>()).add(name));
  });
  return (venue) => {
    const name = (venue ?? "").trim();
    const short = courtShort(name);
    return name && (namesByShort.get(short)?.size ?? 0) > 1 ? name : short;
  };
}

/** "Sat 12 Oct" for a start time or a "yyyy-mm-dd" day; "" when unreadable. */
export function formatDayLabel(value: string, opts: { withMonth?: boolean } = {}): string {
  const plain = DATE_ONLY.exec(value);
  const date = plain ? new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3])) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    ...(opts.withMonth === false ? {} : { month: "short" }),
  }).format(date);
}

/** "15:20" (local, 24h) for a start time; "" when missing. */
export function formatTime(startTime?: string | null): string {
  if (!startTime) return "";
  const at = Date.parse(startTime);
  return Number.isNaN(at) ? "" : localParts(new Date(at)).time;
}

/** "15:00", or "Sun 11 Oct 15:00" when the match isn't today; empty without a start time. */
export function formatWhen(startTime?: string | null, now: Date = new Date()): string {
  const time = formatTime(startTime);
  if (!time || !startTime) return "";
  return isSameLocalDay(startTime, now) ? time : `${formatDayLabel(startTime)} ${time}`;
}

/** Whether a start time falls on the given day (local). */
export function isSameLocalDay(startTime: string | undefined | null, day: Date): boolean {
  if (!startTime) return false;
  const at = Date.parse(startTime);
  return !Number.isNaN(at) && localParts(new Date(at)).day === localParts(day).day;
}
