import {
  formatDateTimeLocal,
  formatShift,
  localInputToIso,
  orderForReschedule,
  parseShift,
  reschedulePreview,
  shiftStartTime,
} from "./reschedule";

// Local wall-clock times, so the tests read the same in every time zone.
const at = (day: number, hours: number, minutes = 0) => new Date(2026, 9, day, hours, minutes).toISOString();

test("a start time as a datetime-local value and back", () => {
  expect(formatDateTimeLocal(at(12, 9, 5))).toBe("2026-10-12T09:05");
  expect(formatDateTimeLocal(undefined)).toBe("");
  expect(formatDateTimeLocal("not a date")).toBe("");

  expect(localInputToIso("2026-10-12T09:05")).toBe(at(12, 9, 5));
  expect(localInputToIso("")).toBeNull();
  expect(localInputToIso("garbage")).toBeNull();
});

test("shifting a start time either way, across midnight too", () => {
  expect(shiftStartTime(at(12, 10), 30)).toBe(at(12, 10, 30));
  expect(shiftStartTime(at(12, 10), -15)).toBe(at(12, 9, 45));
  expect(shiftStartTime(at(12, 23, 30), 60)).toBe(at(13, 0, 30));
});

test("the shift field: signed whole minutes, typed with either minus sign", () => {
  expect(parseShift("+30")).toBe(30);
  expect(parseShift("45")).toBe(45);
  expect(parseShift("-15")).toBe(-15);
  expect(parseShift("−15")).toBe(-15);
  expect(parseShift(" 5 ")).toBe(5);
  expect(parseShift("")).toBeNaN();
  expect(parseShift("1.5")).toBeNaN();
  expect(parseShift("abc")).toBeNaN();

  expect(formatShift(30)).toBe("+30");
  expect(formatShift(-15)).toBe("-15");
  expect(formatShift(0)).toBe("0");
});

describe("reschedulePreview", () => {
  test("earliest–latest before and after, local 24h times", () => {
    const moves = [
      { from: at(12, 10), to: at(12, 10, 30) },
      { from: at(12, 13, 30), to: at(12, 14) },
      { from: at(12, 11), to: at(12, 11, 30) },
    ];
    expect(reschedulePreview(moves)).toBe("3 matches: 10:00–13:30 → 10:30–14:00");
  });

  test("one match, or all at one time", () => {
    expect(reschedulePreview([{ from: at(12, 10), to: at(12, 10, 15) }])).toBe("1 match: 10:00 → 10:15");
    expect(
      reschedulePreview([
        { from: at(12, 10), to: at(12, 15) },
        { from: at(12, 12), to: at(12, 15) },
      ])
    ).toBe("2 matches: 10:00–12:00 → 15:00");
  });

  test("names the day when the times run over more than one day", () => {
    expect(
      reschedulePreview([
        { from: at(12, 22), to: at(12, 23) },
        { from: at(12, 23, 30), to: at(13, 0, 30) },
      ])
    ).toBe("2 matches: Mon 12 Oct 22:00–23:30 → Mon 12 Oct 23:00–Tue 13 Oct 00:30");

    // Moved to another day, all at once.
    expect(reschedulePreview([{ from: at(12, 10), to: at(13, 10) }])).toBe("1 match: Mon 12 Oct 10:00 → Tue 13 Oct 10:00");
  });

  test("matches without a time count, and show as 'no time' when none has one", () => {
    expect(
      reschedulePreview([
        { from: at(12, 10), to: at(12, 15) },
        { from: null, to: at(12, 15) },
      ])
    ).toBe("2 matches: 10:00 → 15:00");
    expect(reschedulePreview([{ from: undefined, to: at(12, 15) }])).toBe("1 match: no time → 15:00");
  });

  test("nothing to preview without a new time", () => {
    expect(reschedulePreview([])).toBe("");
    expect(reschedulePreview([{ from: at(12, 10), to: null }])).toBe("");
  });
});

describe("orderForReschedule", () => {
  type Item = { id: string; from?: string | null; to?: string | null };
  const ids = (items: Item[]) => orderForReschedule(items, (item) => item).map((item) => item.id);

  test("moving later: the latest match first, so none lands on a slot another still holds", () => {
    expect(
      ids([
        { id: "a", from: at(12, 10), to: at(12, 10, 30) },
        { id: "c", from: at(12, 11), to: at(12, 11, 30) },
        { id: "b", from: at(12, 10, 30), to: at(12, 11) },
      ])
    ).toEqual(["c", "b", "a"]);
  });

  test("moving earlier: the earliest match first", () => {
    expect(
      ids([
        { id: "c", from: at(12, 11), to: at(12, 10, 30) },
        { id: "a", from: at(12, 10), to: at(12, 9, 30) },
        { id: "b", from: at(12, 10, 30), to: at(12, 10) },
      ])
    ).toEqual(["a", "b", "c"]);
  });

  test("matches whose time doesn't change go after the moving ones, in the given order", () => {
    expect(
      ids([
        { id: "x", from: null, to: undefined },
        { id: "a", from: at(12, 10), to: at(12, 10, 30) },
        { id: "y", from: at(12, 9), to: undefined },
        { id: "b", from: at(12, 11), to: at(12, 11, 30) },
      ])
    ).toEqual(["b", "a", "x", "y"]);
  });

  test("one time for all (moves of different sizes) keeps the given order", () => {
    const fifteen = at(12, 15);
    expect(
      ids([
        { id: "b", from: at(12, 11), to: fifteen },
        { id: "a", from: at(12, 10), to: fifteen },
        { id: "n", from: null, to: fifteen },
        { id: "late", from: at(12, 17), to: fifteen },
      ])
    ).toEqual(["b", "a", "n", "late"]);

    // All from one time, but a match without a time gets one too: still not a shift.
    expect(
      ids([
        { id: "n", from: null, to: fifteen },
        { id: "a", from: at(12, 10), to: fifteen },
        { id: "b", from: at(12, 10), to: fifteen },
      ])
    ).toEqual(["n", "a", "b"]);
  });

  test("matches at the same time keep their given order, and nothing is lost", () => {
    expect(
      ids([
        { id: "a", from: at(12, 10), to: at(12, 10, 30) },
        { id: "b", from: at(12, 10), to: at(12, 10, 30) },
      ])
    ).toEqual(["a", "b"]);
    expect(ids([])).toEqual([]);
  });
});
