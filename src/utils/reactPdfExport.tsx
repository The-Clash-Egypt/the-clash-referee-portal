import { pdf } from "@react-pdf/renderer";
import { Match } from "../features/matches/types/match";
import MatchesPDFDocument from "../components/MatchesPDFDocument";
import { ScoreDrafts } from "./matchScoreCells";
import { QrLinks } from "./matchSheetLayout";

export type ReportViewType = "venue" | "referee" | "team" | "general";

export interface PDFExportFilters {
  categoryName?: string;
  venueName?: string;
  /** Venues chosen in the multi-select, used for the filename. */
  venueNames?: string[];
  refereeName?: string;
  teamName?: string;
  formatName?: string;
  /** Scores typed into the preview but not yet saved. */
  scoreDrafts?: ScoreDrafts;
  /** Guest links for the match QRs, keyed by match id. */
  qrLinks?: QrLinks;
}

interface PDFExportOptions extends PDFExportFilters {
  filename?: string;
  viewType: ReportViewType;
  tournamentName: string;
}

const renderBlob = (matches: Match[], options: PDFExportOptions): Promise<Blob> => {
  const { viewType, tournamentName, categoryName, venueName, refereeName, teamName, formatName, scoreDrafts, qrLinks } =
    options;

  return pdf(
    <MatchesPDFDocument
      matches={matches}
      tournamentName={tournamentName}
      categoryName={categoryName}
      venueName={venueName}
      refereeName={refereeName}
      teamName={teamName}
      formatName={formatName}
      viewType={viewType}
      scoreDrafts={scoreDrafts}
      qrLinks={qrLinks}
    />
  ).toBlob();
};

/** Names the file after whatever the report was actually filtered to. */
const buildFilename = (
  viewType: ReportViewType,
  tournamentName: string,
  filters: PDFExportFilters
): string => {
  const { categoryName, venueName, venueNames, refereeName, teamName, formatName } = filters;
  const venueLabel = venueNames && venueNames.length > 0 ? venueNames.join("-") : venueName;

  const parts: string[] = [];
  switch (viewType) {
    case "venue":
      if (venueLabel) parts.push(venueLabel);
      break;
    case "referee":
      if (refereeName) parts.push(refereeName);
      break;
    case "team":
      if (teamName) parts.push(teamName);
      break;
    default:
      if (venueLabel) parts.push(venueLabel);
      if (refereeName) parts.push(refereeName);
      if (teamName) parts.push(teamName);
      break;
  }
  if (categoryName) parts.push(categoryName);
  if (formatName) parts.push(formatName);

  const timestamp = new Date().toISOString().split("T")[0];
  const name = [tournamentName, ...parts, "matches", timestamp].join("-");

  // Non-Latin names would otherwise collapse to a row of dashes.
  const cleaned = name
    .replace(/[^a-z0-9.-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return `${cleaned || "matches"}.pdf`;
};

const failure = (action: string, error: unknown): Error => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Failed to ${action} PDF:`, error);
  return new Error(`Failed to ${action} PDF: ${message}`);
};

const triggerDownload = (url: string, filename: string): void => {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/** Downloads the matches report. */
export const exportMatchesToPDF = async (
  matches: Match[],
  options: PDFExportOptions
): Promise<void> => {
  try {
    const blob = await renderBlob(matches, options);
    const url = URL.createObjectURL(blob);
    triggerDownload(url, options.filename || "matches-report.pdf");
    URL.revokeObjectURL(url);
  } catch (error) {
    throw failure("export", error);
  }
};

/** Opens the matches report in a new tab, falling back to a download if blocked. */
export const previewMatchesPDF = async (
  matches: Match[],
  options: PDFExportOptions
): Promise<void> => {
  try {
    const blob = await renderBlob(matches, options);
    const url = URL.createObjectURL(blob);
    const preview = window.open(url, "_blank", "noopener,noreferrer");

    if (!preview) {
      triggerDownload(url, options.filename || "matches-report.pdf");
    }

    // Give the new tab (or the download) time to read the blob before releasing it.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    throw failure("preview", error);
  }
};

export const exportMatchesToPDFWithFilename = (
  matches: Match[],
  viewType: ReportViewType,
  tournamentName: string,
  filters: PDFExportFilters = {}
): Promise<void> =>
  exportMatchesToPDF(matches, {
    filename: buildFilename(viewType, tournamentName, filters),
    viewType,
    tournamentName,
    ...filters,
  });

export const previewMatchesPDFWithFilename = (
  matches: Match[],
  viewType: ReportViewType,
  tournamentName: string,
  filters: PDFExportFilters = {}
): Promise<void> =>
  previewMatchesPDF(matches, {
    filename: buildFilename(viewType, tournamentName, filters),
    viewType,
    tournamentName,
    ...filters,
  });
