import { Match } from "../features/matches/types/match";
import { distinctCategories, headerCategory, shouldLabelCategories } from "./matchSheetFormat";

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
