import { Match } from "../features/matches/types/match";
import { SCORE_BOX_AREA_WIDTH } from "./matchScoreCells";
import { MATCHES_PER_PAGE, SHEET, paginateSheets, sheetCssVariables, sheetSubjectTitle } from "./matchSheetLayout";

const m = (id: string, venue?: string, startTime?: string): Match =>
  ({ id, venue, startTime, isCompleted: false }) as Match;

describe("paginateSheets", () => {
  it("puts at most three matches on a page and never mixes courts", () => {
    const court1 = Array.from({ length: 5 }, (_, i) => m(`a${i}`, "Court 1", `2026-09-12T0${i}:00:00Z`));
    const pages = paginateSheets([...court1, m("b0", "Court 2", "2026-09-12T01:00:00Z")], "general", "All venues");

    expect(pages.map((page) => [page.title, page.matches.map((match) => match.id)])).toEqual([
      ["Court 1", ["a0", "a1", "a2"]],
      ["Court 1", ["a3", "a4"]],
      ["Court 2", ["b0"]],
    ]);
    expect(pages.map((page) => page.firstPosition)).toEqual([1, 4, 1]);
    expect(pages.map((page) => page.groupSize)).toEqual([5, 5, 1]);
    expect(new Set(pages.map((page) => page.key)).size).toBe(3);
  });

  it("keeps referee and team reports as one chronological run across courts", () => {
    const pages = paginateSheets(
      [m("late", "Court 2", "2026-09-12T12:00:00Z"), m("early", "Court 1", "2026-09-12T09:00:00Z")],
      "referee",
      "Mona Salah"
    );

    expect(pages).toHaveLength(1);
    expect(pages[0].title).toBe("Mona Salah");
    expect(pages[0].matches.map((match) => match.id)).toEqual(["early", "late"]);
  });

  it("still produces one page for an empty report", () => {
    expect(paginateSheets([], "venue", "Court 9")).toEqual([
      { key: "empty", title: "Court 9", matches: [], firstPosition: 1, groupSize: 0 },
    ]);
  });
});

describe("sheetSubjectTitle", () => {
  it("names the sheet after what the report is about", () => {
    expect(sheetSubjectTitle("venue", { venueName: "Court 3" })).toBe("Court 3");
    expect(sheetSubjectTitle("general", {})).toBe("All venues");
    expect(sheetSubjectTitle("referee", { refereeName: "Mona" })).toBe("Mona");
    expect(sheetSubjectTitle("team", {})).toBe("Matches");
  });
});

describe("SHEET geometry", () => {
  it("fits three cards between the header and the footer", () => {
    const used = SHEET.headerHeight + SHEET.bodyPaddingTop + MATCHES_PER_PAGE * (SHEET.cardHeight + SHEET.cardGap);
    expect(used).toBeLessThanOrEqual(SHEET.pageHeight - SHEET.footerHeight);
  });

  it("fits the name column, five full boxes and the QR across a card", () => {
    const inner = SHEET.pageWidth - 2 * SHEET.marginX - 2 * SHEET.cardPadding - 2 * 0.75;
    expect(SHEET.nameWidth + SCORE_BOX_AREA_WIDTH + 12 + SHEET.qrColumnWidth).toBeLessThanOrEqual(inner);
  });

  it("exposes the same numbers to CSS", () => {
    expect(sheetCssVariables()["--sheet-card-height"]).toBe(`${SHEET.cardHeight}pt`);
    expect(sheetCssVariables()["--sheet-box-area"]).toBe(`${SCORE_BOX_AREA_WIDTH}pt`);
  });
});
