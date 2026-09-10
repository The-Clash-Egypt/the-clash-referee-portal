import { Match } from "../features/matches/types/match";
import { distinctCategories, headerCategory, shouldLabelCategories, formatClock, formatValidUntil } from "./matchSheetFormat";

const match = (categoryName?: string): Match => ({ id: "m", categoryName, isCompleted: false }) as Match;

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
    const spy = jest.spyOn(Date.prototype, "toLocaleTimeString").mockReturnValue("2:32 PM");
    expect(formatValidUntil(new Date(2026, 8, 11, 14, 32).toISOString())).toBe("Fri 11 Sep, 2:32 PM");
    expect(formatClock(new Date(2026, 8, 12, 10, 30).toISOString())).toBe("2:32 PM");
    spy.mockRestore();
  });
});
