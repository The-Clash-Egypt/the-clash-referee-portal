import { Match } from "../features/matches/types/match";
import { SCORE_BOX_AREA_WIDTH, SCORE_BOX_GAP, SCORE_CELL_HEIGHT } from "./matchScoreCells";
import { compareStartTimes, groupMatchesByVenue, shouldGroupByVenue } from "./venueGrouping";

/**
 * Page geometry of the match sheet, in PDF points (A4 portrait). MatchesPDFDocument reads these
 * directly; the HTML preview gets them as CSS custom properties (sheetCssVariables) — one set of
 * numbers, so the preview and the PDF cannot drift apart.
 *
 * Vertical budget: 58 header + 12 padding + 4 × (176 card + 8 gap) = 806pt ≤ 841.89 − 30 footer.
 * Horizontal: 170 names + 170 boxes + 12 gutter + 140 QR = 492pt ≤ 501.78 inside a card.
 */
export const SHEET = {
  pageWidth: 595.28,
  pageHeight: 841.89,
  marginX: 34,
  headerHeight: 58,
  footerHeight: 30,
  bodyPaddingTop: 12,
  cardHeight: 176,
  cardGap: 8,
  cardPadding: 12,
  liveEdge: 3,
  nameWidth: 170,
  qrColumnWidth: 140,
  qrSize: 120,
} as const;

export const MATCHES_PER_PAGE = 4;

/** The guest link a match's QR encodes, and when it stops working. */
export interface QrLink {
  url: string;
  expiresAt: string;
}

export type QrLinks = Record<string, QrLink>;

export type QrStatus = "idle" | "loading" | "ready" | "failed";

export interface SheetPage {
  key: string;
  /** Header title: the court, or the referee/team the report is about. */
  title: string;
  matches: Match[];
  /** The #n of the page's first match, counted within its court (or the whole run). */
  firstPosition: number;
  /** Matches in this page's court (or run) — the header's count. */
  groupSize: number;
}

const chunk = (key: string, title: string, matches: Match[]): SheetPage[] => {
  const pages: SheetPage[] = [];
  for (let start = 0; start < matches.length; start += MATCHES_PER_PAGE) {
    pages.push({
      key: `${key}-${start / MATCHES_PER_PAGE + 1}`,
      title,
      matches: matches.slice(start, start + MATCHES_PER_PAGE),
      firstPosition: start + 1,
      groupSize: matches.length,
    });
  }
  return pages;
};

const emptyReport = (title: string): SheetPage[] => [{ key: "empty", title, matches: [], firstPosition: 1, groupSize: 0 }];

export const sheetSubjectTitle = (
  viewType: string,
  names: { venueName?: string; refereeName?: string; teamName?: string }
): string => {
  if (shouldGroupByVenue(viewType)) return names.venueName || "All venues";
  if (viewType === "referee") return names.refereeName || "Matches";
  return names.teamName || "Matches";
};

/**
 * Court and general reports: each court on its own pages, four matches a page.
 * Referee and team reports: one chronological run across courts, four a page.
 */
export const paginateSheets = (matches: Match[], viewType: string, subjectTitle: string): SheetPage[] => {
  if (shouldGroupByVenue(viewType)) {
    const groups = groupMatchesByVenue(matches);
    return groups.length === 0 ? emptyReport(subjectTitle) : groups.flatMap((group) => chunk(group.venue, group.venue, group.matches));
  }

  const run = [...matches].sort(compareStartTimes);
  return run.length === 0 ? emptyReport(subjectTitle) : chunk("run", subjectTitle, run);
};

/** SHEET and the box geometry as CSS custom properties for the HTML preview. */
export const sheetCssVariables = (): Record<string, string> => ({
  "--sheet-page-width": `${SHEET.pageWidth}pt`,
  "--sheet-page-height": `${SHEET.pageHeight}pt`,
  "--sheet-margin-x": `${SHEET.marginX}pt`,
  "--sheet-header-height": `${SHEET.headerHeight}pt`,
  "--sheet-footer-height": `${SHEET.footerHeight}pt`,
  "--sheet-body-padding-top": `${SHEET.bodyPaddingTop}pt`,
  "--sheet-card-height": `${SHEET.cardHeight}pt`,
  "--sheet-card-gap": `${SHEET.cardGap}pt`,
  "--sheet-card-padding": `${SHEET.cardPadding}pt`,
  "--sheet-live-edge": `${SHEET.liveEdge}pt`,
  "--sheet-name-width": `${SHEET.nameWidth}pt`,
  "--sheet-qr-column": `${SHEET.qrColumnWidth}pt`,
  "--sheet-qr-size": `${SHEET.qrSize}pt`,
  "--sheet-box-area": `${SCORE_BOX_AREA_WIDTH}pt`,
  "--sheet-box-gap": `${SCORE_BOX_GAP}pt`,
  "--sheet-box-height": `${SCORE_CELL_HEIGHT}pt`,
});
