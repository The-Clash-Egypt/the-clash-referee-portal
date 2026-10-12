import { formatDayLabel, formatTime } from "./timeline";

/**
 * Moving matches in time (the bulk edit sheet's Start time; the edit sheet's datetime field): the input's local value,
 * shifts, the before → after preview, and the order to save moves in so they don't collide on the server.
 */

const readTime = (startTime?: string | null): number | null => {
  if (!startTime) return null;
  const time = Date.parse(startTime);
  return Number.isNaN(time) ? null : time;
};

const pad = (value: number) => String(value).padStart(2, "0");

/** A start time as a datetime-local input's value ("2026-10-12T15:20", local); "" when missing or unreadable. */
export const formatDateTimeLocal = (startTime?: string | null): string => {
  const time = readTime(startTime);
  if (time === null) return "";
  const date = new Date(time);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
};

/** A datetime-local input's value (local) as the ISO time the API takes; null when empty or unreadable. */
export const localInputToIso = (value: string): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/** Whether a match has a start time that can be read (and so moved). */
export const hasStartTime = (startTime?: string | null): startTime is string => readTime(startTime) !== null;

/** A start time moved by some minutes (negative: earlier), as ISO. */
export const shiftStartTime = (startTime: string, minutes: number): string =>
  new Date(Date.parse(startTime) + minutes * 60_000).toISOString();

/** The minutes typed in the shift field ("+30", "-15", "−15", "45"); NaN unless it's a whole number. */
export const parseShift = (text: string): number => {
  const value = text.trim().replace(/−/g, "-");
  return /^[+-]?\d+$/.test(value) ? parseInt(value, 10) : NaN;
};

/** A shift as the field shows it: "+30", "-15", "0". */
export const formatShift = (minutes: number): string => (minutes > 0 ? `+${minutes}` : String(Math.trunc(minutes) || 0));

/** A match's start time before and after a change (`to` empty: the time doesn't change). */
export interface TimeMove {
  from?: string | null;
  to?: string | null;
}

const localDay = (time: number) => new Date(time).toDateString();

/** "10:00–13:30", "10:00", or with the day: "Mon 12 Oct 10:00–13:30", "Mon 12 Oct 23:00–Tue 13 Oct 00:30". */
const timeSpan = (times: number[], withDay: boolean): string => {
  if (times.length === 0) return "no time";
  const earliest = new Date(Math.min(...times)).toISOString();
  const latest = new Date(Math.max(...times)).toISOString();
  const label = (iso: string) => (withDay ? `${formatDayLabel(iso)} ${formatTime(iso)}` : formatTime(iso));
  if (earliest === latest) return label(earliest);
  if (withDay && localDay(Date.parse(earliest)) === localDay(Date.parse(latest))) {
    return `${label(earliest)}–${formatTime(latest)}`;
  }
  return `${label(earliest)}–${label(latest)}`;
};

/**
 * What a time change does, earliest–latest before and after: "8 matches: 10:00–13:30 → 10:30–14:00". The day is
 * named when the times (before or after) fall on more than one day. "" when nothing gets a new time.
 */
export const reschedulePreview = (moves: TimeMove[]): string => {
  const before = moves.map((move) => readTime(move.from)).filter((time): time is number => time !== null);
  const after = moves.map((move) => readTime(move.to)).filter((time): time is number => time !== null);
  if (after.length === 0) return "";
  const withDay = new Set([...before, ...after].map(localDay)).size > 1;
  const count = `${moves.length} ${moves.length === 1 ? "match" : "matches"}`;
  return `${count}: ${timeSpan(before, withDay)} → ${timeSpan(after, withDay)}`;
};

/**
 * The order to save time changes in. The server refuses two matches on one court at the same start time, so when a
 * court's 10:00 and 10:30 matches both move 30 minutes later, the 10:30 one has to move first. When every moving match
 * moves by the same amount (a shift), later moves go latest first and earlier moves earliest first; anything else (one
 * time for all) keeps the given order. Matches whose time doesn't change come after the moving ones, in the given order.
 */
export function orderForReschedule<T>(items: T[], timesOf: (item: T) => TimeMove): T[] {
  const entries = items.map((item, index) => {
    const { from, to } = timesOf(item);
    const start = readTime(from);
    const end = readTime(to);
    // A match without a time that gets one moves by an unknown amount (NaN): that's never a shift.
    const moves = end !== null && end !== start;
    const delta = moves ? (start === null ? NaN : end - start) : 0;
    return { item, index, start: start ?? 0, moves, delta };
  });
  const moving = entries.filter((entry) => entry.moves);
  const staying = entries.filter((entry) => !entry.moves);
  const shift = moving.length > 0 && moving.every((entry) => entry.delta === moving[0].delta);
  if (!shift) return items.slice();

  const latestFirst = moving[0].delta > 0;
  const ordered = moving
    .slice()
    .sort((a, b) => (latestFirst ? b.start - a.start : a.start - b.start) || a.index - b.index);
  return [...ordered, ...staying].map((entry) => entry.item);
}
