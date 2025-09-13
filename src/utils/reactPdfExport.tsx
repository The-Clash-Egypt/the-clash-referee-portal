import { pdf } from "@react-pdf/renderer";
import { Match } from "../features/matches/types/match";
import MatchesPDFDocument from "../components/MatchesPDFDocument";

interface PDFExportOptions {
  filename?: string;
  viewType: "venue" | "referee" | "team" | "general";
  tournamentName: string;
  categoryName?: string;
  venueName?: string;
  refereeName?: string;
  teamName?: string;
  formatName?: string;
}

/**
 * Exports matches to PDF using React PDF
 * @param matches - Array of matches to export
 * @param options - Export options
 */
export const exportMatchesToPDF = async (matches: Match[], options: PDFExportOptions): Promise<void> => {
  const {
    filename = "matches-report.pdf",
    viewType,
    tournamentName,
    categoryName,
    venueName,
    refereeName,
    teamName,
    formatName,
  } = options;

  try {
    console.log("Starting React PDF export with options:", options);
    console.log(`Exporting ${matches.length} matches`);

    // Create the PDF document
    const doc = (
      <MatchesPDFDocument
        matches={matches}
        tournamentName={tournamentName}
        categoryName={categoryName}
        venueName={venueName}
        refereeName={refereeName}
        teamName={teamName}
        formatName={formatName}
        viewType={viewType}
      />
    );

    console.log("PDF document created, generating blob...");

    // Generate PDF blob
    const blob = await pdf(doc).toBlob();

    console.log("PDF blob generated successfully, size:", blob.size);

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up
    URL.revokeObjectURL(url);

    console.log("PDF exported successfully:", filename);
  } catch (error) {
    console.error("Error exporting PDF with React PDF:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      matches: matches.length,
      options,
    });
    throw new Error(`Failed to export PDF: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
};

/**
 * Exports matches to PDF with automatic filename generation
 * @param matches - Array of matches to export
 * @param viewType - Type of view being exported
 * @param tournamentName - Name of the tournament
 * @param filters - Additional filter information
 */
export const exportMatchesToPDFWithFilename = async (
  matches: Match[],
  viewType: "venue" | "referee" | "team" | "general",
  tournamentName: string,
  filters: {
    categoryName?: string;
    venueName?: string;
    refereeName?: string;
    teamName?: string;
    formatName?: string;
  } = {}
): Promise<void> => {
  // Generate filename based on filters
  const timestamp = new Date().toISOString().split("T")[0];
  const filterParts = [];

  // Add primary filter based on view type
  switch (viewType) {
    case "venue":
      if (filters.venueName) filterParts.push(filters.venueName);
      break;
    case "referee":
      if (filters.refereeName) filterParts.push(filters.refereeName);
      break;
    case "team":
      if (filters.teamName) filterParts.push(filters.teamName);
      break;
    default:
      // For general view, add all active filters
      if (filters.venueName) filterParts.push(filters.venueName);
      if (filters.refereeName) filterParts.push(filters.refereeName);
      if (filters.teamName) filterParts.push(filters.teamName);
      break;
  }

  // Add additional filters
  if (filters.categoryName) filterParts.push(filters.categoryName);
  if (filters.formatName) filterParts.push(filters.formatName);

  // Build filename
  let filename;
  if (filterParts.length > 0) {
    const filterString = filterParts.join("-");
    filename = `${tournamentName}-${filterString}-matches-${timestamp}.pdf`;
  } else {
    filename = `${tournamentName}-matches-${timestamp}.pdf`;
  }

  // Clean filename for filesystem
  filename = filename.replace(/[^a-z0-9.-]/gi, "-").toLowerCase();

  await exportMatchesToPDF(matches, {
    filename,
    viewType,
    tournamentName,
    ...filters,
  });
};
