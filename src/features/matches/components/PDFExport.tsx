import React from "react";
import jsPDF from "jspdf";
import { Match } from "../types/match";

interface PDFExportProps {
  matches: Match[];
  tournamentName: string;
  categoryName?: string;
  venueName?: string;
  refereeName?: string;
  teamName?: string;
  exportType: "venue" | "referee" | "team" | "general";
  onExport: () => void;
  loading?: boolean;
}

const PDFExport: React.FC<PDFExportProps> = ({
  matches,
  tournamentName,
  categoryName,
  venueName,
  refereeName,
  teamName,
  exportType,
  onExport,
  loading = false,
}) => {
  const formatTime = (timeString?: string) => {
    if (!timeString) return "TBD";
    const date = new Date(timeString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatScore = (match: Match) => {
    if (match.gameScores && match.gameScores.length > 0) {
      return match.gameScores.map((score) => `${score.homeScore}-${score.awayScore}`).join(", ");
    }
    return match.homeScore !== undefined && match.awayScore !== undefined
      ? `${match.homeScore}-${match.awayScore}`
      : "TBD";
  };

  const getRefereesList = (referees?: any[]) => {
    if (!referees || referees.length === 0) return "Unassigned";
    return referees.map((ref) => ref.fullName || ref.name || "Unknown").join(", ");
  };

  const safeString = (str: any): string => {
    if (str === null || str === undefined) return "TBD";

    // Handle Unicode characters properly
    try {
      const stringValue = String(str);

      // Convert Unicode characters to a format that jsPDF can handle
      // This ensures Cyrillic, Arabic, Chinese, and other Unicode characters display correctly
      return stringValue
        .normalize("NFC") // Normalize Unicode characters
        .replace(/[\u0080-\uFFFF]/g, (char) => {
          // For characters outside ASCII range, we'll use a fallback approach
          // This preserves the character but ensures it can be rendered
          return char;
        });
    } catch (error) {
      console.warn("Error processing string:", str, error);
      return "TBD";
    }
  };

  // Helper function to add Unicode-safe text to PDF
  const addUnicodeText = (doc: jsPDF, text: string, x: number, y: number, options?: any) => {
    try {
      // Split text into lines for proper wrapping
      const lines = doc.splitTextToSize(text, options?.maxWidth || 200);

      // Add each line to the PDF
      lines.forEach((line: string, index: number) => {
        doc.text(line, x, y + index * (options?.lineHeight || 6));
      });

      return lines.length;
    } catch (error) {
      console.warn("Error adding Unicode text to PDF:", text, error);
      // Fallback: try to add basic text
      try {
        doc.text("Text unavailable", x, y);
        return 1;
      } catch (fallbackError) {
        console.error("Failed to add fallback text:", fallbackError);
        return 0;
      }
    }
  };

  const generatePDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let yPosition = margin;

      // Helper function to add a line
      const addLine = (y: number) => {
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageWidth - margin, y);
        return y + 5;
      };

      // Title - use Unicode-safe rendering
      const titleLines = addUnicodeText(doc, safeString(tournamentName), margin, yPosition, {
        maxWidth: pageWidth - 2 * margin,
        lineHeight: 8,
      });
      doc.setFontSize(18);
      yPosition += titleLines * 8 + 5;

      // Subtitle based on export type
      let subtitle = "";
      switch (exportType) {
        case "venue":
          subtitle = venueName ? `Venue: ${safeString(venueName)}` : "All Venues";
          break;
        case "referee":
          subtitle = refereeName ? `Referee: ${safeString(refereeName)}` : "All Referees";
          break;
        case "team":
          subtitle = teamName ? `Team: ${safeString(teamName)}` : "All Teams";
          break;
        default:
          subtitle = "Matches Report";
      }

      if (categoryName) {
        subtitle += ` | Category: ${safeString(categoryName)}`;
      }

      doc.setFontSize(14);
      const subtitleLines = addUnicodeText(doc, subtitle, margin, yPosition, {
        maxWidth: pageWidth - 2 * margin,
        lineHeight: 6,
      });
      yPosition += subtitleLines * 6 + 10;

      // Add line separator
      yPosition = addLine(yPosition);
      yPosition += 5;

      // Add matches as form fields
      matches.forEach((match, index) => {
        // Check if we need a new page
        if (yPosition > doc.internal.pageSize.getHeight() - 80) {
          doc.addPage();
          yPosition = margin;
        }

        // Match header
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, yPosition, pageWidth - 2 * margin, 15, "F");

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`Match ${index + 1}`, margin + 5, yPosition + 10);

        yPosition += 20;

        // Match details
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");

        const matchDetails = [
          `Teams: ${safeString(match.homeTeamName)} vs ${safeString(match.awayTeamName)}`,
          `Venue: ${safeString(match.venue)}`,
          `Round: ${safeString(match.round)}`,
          `Format: ${safeString(match.format)}`,
          `Referee(s): ${getRefereesList(match.referees)}`,
          `Time: ${formatTime(match.startTime)}`,
        ];

        matchDetails.forEach((detail) => {
          // Use Unicode-safe text rendering
          const linesAdded = addUnicodeText(doc, detail, margin + 5, yPosition, {
            maxWidth: pageWidth - 2 * margin - 10,
            lineHeight: 6,
          });
          yPosition += linesAdded * 6;
        });

        yPosition += 5;

        // Score input section
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Score Input:", margin + 5, yPosition);
        yPosition += 8;

        // Current score display
        const currentScore = formatScore(match);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Current Score: ${currentScore}`, margin + 5, yPosition);
        yPosition += 6;

        // Score input fields based on bestOf value
        const bestOf = match.bestOf || 3;

        for (let game = 1; game <= bestOf; game++) {
          const gameScore = match.gameScores?.find((gs) => gs.gameNumber === game);
          const homeScore = gameScore ? gameScore.homeScore : "";
          const awayScore = gameScore ? gameScore.awayScore : "";

          // Game label
          doc.text(`Game ${game}:`, margin + 5, yPosition);

          // Home team score input box
          doc.setFillColor(255, 255, 255);
          doc.rect(margin + 30, yPosition - 4, 20, 8, "F");
          doc.setDrawColor(0, 0, 0);
          doc.rect(margin + 30, yPosition - 4, 20, 8, "S");
          doc.text(String(homeScore), margin + 33, yPosition + 1);

          // vs text
          doc.text("vs", margin + 55, yPosition);

          // Away team score input box
          doc.setFillColor(255, 255, 255);
          doc.rect(margin + 70, yPosition - 4, 20, 8, "F");
          doc.setDrawColor(0, 0, 0);
          doc.rect(margin + 70, yPosition - 4, 20, 8, "S");
          doc.text(String(awayScore), margin + 73, yPosition + 1);

          yPosition += 12;
        }

        // Separator line
        if (index < matches.length - 1) {
          doc.setDrawColor(200, 200, 200);
          doc.line(margin, yPosition, pageWidth - margin, yPosition);
          yPosition += 10;
        }
      });

      // Add footer
      const footerY = yPosition + 20;

      doc.setFontSize(10);
      addUnicodeText(doc, `Generated on: ${new Date().toLocaleString()}`, margin, footerY, {
        maxWidth: pageWidth - 2 * margin,
        lineHeight: 5,
      });
      addUnicodeText(doc, `The Clash Referee Portal`, pageWidth - margin - 60, footerY, {
        maxWidth: 60,
        lineHeight: 5,
      });

      // Save the PDF
      const fileName = `${tournamentName}_${exportType}_matches_${new Date().toISOString().split("T")[0]}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("Error in generatePDF:", error);
      throw error;
    }
  };

  const handleExport = () => {
    try {
      console.log("Starting PDF generation...", {
        matches: matches.length,
        exportType,
        tournamentName,
        sampleMatch: matches[0],
      });

      if (matches.length === 0) {
        alert("No matches to export");
        return;
      }

      generatePDF();
      onExport();
    } catch (error) {
      console.error("Error generating PDF:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack");
      alert(`Failed to generate PDF: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading || matches.length === 0}
      className="pdf-export-btn"
      title={matches.length === 0 ? "No matches to export" : `Export ${exportType} matches to PDF`}
    >
      {loading ? (
        <>
          <span className="loading-spinner"></span>
          Exporting...
        </>
      ) : (
        <>Export to PDF</>
      )}
    </button>
  );
};

export default PDFExport;
