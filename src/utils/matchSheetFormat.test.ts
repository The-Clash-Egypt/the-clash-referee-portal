import { Match } from "../features/matches/types/match";
import {
  cardMetaItems,
  cardRuleLabel,
  distinctCategories,
  formatClock,
  formatShortDay,
  formatValidUntil,
  headerCategory,
  qrCaption,
  reportSpansMultipleDays,
  shouldLabelCategories,
} from "./matchSheetFormat";

const match = (categoryName?: string): Match => ({ id: "m", categoryName, isCompleted: false }) as Match;

afterEach(() => jest.restoreAllMocks());

describe("distinctCategories", () => {
  it("lists each category once, in first-seen order", () => {
    expect(distinctCategories([match("2v2 Men"), match("2v2 Women"), match("2v2 Men")])).toEqual([
      "2v2 Men",
      "2v2 Women",
    ]);
  });

  it("ignores missing and blank categories", () => {
    expect(distinctCategories([match(), match("   "), match("2v2 Men")])).toEqual(["2v2 Men"]);
  });
});

describe("shouldLabelCategories", () => {
  it("labels rows only when the report spans more than one category", () => {
    expect(shouldLabelCategories([match("2v2 Men"), match("2v2 Women")])).toBe(true);
    expect(shouldLabelCategories([match("2v2 Men"), match("2v2 Men")])).toBe(false);
    expect(shouldLabelCategories([])).toBe(false);
  });
});

describe("headerCategory", () => {
  it("prefers the filtered category", () => {
    expect(headerCategory("2v2 Men", [match("2v2 Men"), match("2v2 Women")])).toBe("2v2 Men");
  });

  it("falls back to the report's only category when nothing is filtered", () => {
    expect(headerCategory(undefined, [match("2v2 Men"), match("2v2 Men")])).toBe("2v2 Men");
  });

  it("stays empty when the report spans several categories", () => {
    expect(headerCategory(undefined, [match("2v2 Men"), match("2v2 Women")])).toBeUndefined();
  });
});

describe("formatValidUntil", () => {
  it("reads as a short day, date and clock time", () => {
    // 11 Sep 2026 is a Friday; built in local time so the test is timezone-proof.
    expect(formatValidUntil(new Date(2026, 8, 11, 14, 32).toISOString())).toBe("Fri 11 Sep, 2:32 PM");
  });

  it("is empty for an unreadable date", () => {
    expect(formatValidUntil("not a date")).toBe("");
  });
});

describe("formatClock", () => {
  it("uses a plain space before AM/PM, never U+202F", () => {
    expect(formatClock(new Date(2026, 8, 12, 10, 30).toISOString())).toBe("10:30 AM");
  });

  it("replaces the narrow no-break space newer ICU puts before AM/PM", () => {
    jest.spyOn(Date.prototype, "toLocaleTimeString").mockReturnValue("2:32 PM");
    expect(formatValidUntil(new Date(2026, 8, 11, 14, 32).toISOString())).toBe("Fri 11 Sep, 2:32 PM");
    expect(formatClock(new Date(2026, 8, 12, 10, 30).toISOString())).toBe("2:32 PM");
  });
});

describe("card text", () => {
  const at = (day: number, hour: number) => new Date(2026, 8, day, hour, 30).toISOString();
  const card = (over: Partial<Match> = {}): Match =>
    ({ id: "m", isCompleted: false, bestOf: 3, formatType: "Group", round: "Round 1", startTime: at(12, 10), ...over }) as Match;

  it("formats a short day", () => {
    expect(formatShortDay(at(12, 10))).toBe("Sat 12 Sep");
    expect(formatShortDay(undefined)).toBe("Date TBC");
  });

  it("knows when a report spans several days", () => {
    expect(reportSpansMultipleDays([card(), card({ startTime: at(12, 16) })])).toBe(false);
    expect(reportSpansMultipleDays([card(), card({ startTime: at(13, 9) })])).toBe(true);
  });

  it("builds the card's meta line from only what the report needs", () => {
    expect(cardMetaItems(card(), 3, { showDate: false, showCategory: false, showCourt: false })).toEqual([
      "#3",
      "10:30 AM",
      "Round 1",
    ]);
    expect(
      cardMetaItems(card({ categoryName: "Women", venue: " Court 2 " }), 1, { showDate: true, showCategory: true, showCourt: true })
    ).toEqual(["#1", "Sat 12 Sep", "10:30 AM", "Round 1", "Women", "Court 2"]);
  });

  it("labels the scoring rule, never a final score", () => {
    expect(cardRuleLabel(card())).toBe("Best of 3");
    expect(cardRuleLabel(card({ isCompleted: true, homeScore: 2, awayScore: 1 }))).toBe("Best of 3");
    expect(cardRuleLabel(card({ formatType: "Americano", pointsPerMatch: 21 }))).toBe("Americano · to 21 pts");
    expect(
      cardRuleLabel(
        card({ formatType: "Mexicano", pointsPerMatch: 24, isCompleted: true, gameScores: [{ gameNumber: 1, homeScore: 13, awayScore: 11 }] })
      )
    ).toBe("Mexicano · to 24 pts");
  });

  it("captions the QR for what a scan will do", () => {
    expect(qrCaption(card())).toBe("Scan to enter score");
    expect(qrCaption(card({ isCompleted: true }))).toBe("Scan to view result");
  });
});
