import React, { useState } from "react";
import QRCode from "react-qr-code";
import { Match, isFixedPointsFormat, sideDisplayName } from "../types/match";
import { previewMatchesPDFWithFilename } from "../../../utils/reactPdfExport";
import { shouldGroupByVenue } from "../../../utils/venueGrouping";
import { ScoreCell, ScoreDrafts, isCellWinner, scoreCellWidth, scoreCellsFor } from "../../../utils/matchScoreCells";
import {
  QrLinks,
  QrStatus,
  SheetPage,
  paginateSheets,
  sheetCssVariables,
  sheetSubjectTitle,
} from "../../../utils/matchSheetLayout";
import {
  CardMetaOptions,
  cardMetaItems,
  cardRuleLabel,
  formatMembers,
  formatReferees,
  formatValidUntil,
  headerCategory,
  matchCountLabel,
  matchIsLive,
  printedOnLabel,
  qrCaption,
  reportSpansMultipleDays,
  sheetMeta,
  shouldLabelCategories,
} from "../../../utils/matchSheetFormat";

interface PrintableViewProps {
  matches: Match[];
  tournamentName: string;
  categoryName?: string;
  venueName?: string;
  venueNames?: string[];
  refereeName?: string;
  teamName?: string;
  formatName?: string;
  viewType: "venue" | "referee" | "team" | "general";
  onClose: () => void;
  /** Guest links for the match QRs, keyed by match id. */
  qrLinks?: QrLinks;
  qrStatus?: QrStatus;
  onRetryQr?: () => void;
}

/**
 * The on-screen twin of MatchesPDFDocument: same pagination (paginateSheets), same geometry
 * (SHEET via CSS custom properties), same card text. Scores typed into the boxes are drafts
 * that flow into the PDF; nothing here saves to the server.
 */
const PrintableView: React.FC<PrintableViewProps> = ({
  matches,
  tournamentName,
  categoryName,
  venueName,
  venueNames,
  refereeName,
  teamName,
  formatName,
  viewType,
  onClose,
  qrLinks = {},
  qrStatus = "ready",
  onRetryQr,
}) => {
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [scoreDrafts, setScoreDrafts] = useState<ScoreDrafts>({});

  /**
   * Seeds from the match itself rather than an empty array. Seeding from `[]` stored an empty
   * grid, which then won the lookup and unmounted the inputs on the first keystroke.
   */
  const cellsForMatch = (match: Match): ScoreCell[] => scoreDrafts[match.id] ?? scoreCellsFor(match);

  const updateScoreCell = (match: Match, gameNumber: number, side: "home" | "away", raw: string) => {
    const digits = raw.replace(/[^0-9]/g, "").slice(0, 3);
    const value = digits === "" ? null : parseInt(digits, 10);

    setScoreDrafts((previous) => {
      const base = previous[match.id] ?? scoreCellsFor(match);
      return {
        ...previous,
        [match.id]: base.map((cell) => (cell.gameNumber === gameNumber ? { ...cell, [side]: value } : cell)),
      };
    });
  };

  const getViewTitle = () => {
    const filters: string[] = [];

    switch (viewType) {
      case "venue":
        if (venueNames && venueNames.length > 1) filters.push(venueNames.join(", "));
        else if (venueName) filters.push(`${venueName}`);
        break;
      case "referee":
        if (refereeName) filters.push(`Referee: ${refereeName}`);
        break;
      case "team":
        if (teamName) filters.push(`Team: ${teamName}`);
        break;
      default:
        if (venueNames && venueNames.length > 1) filters.push(venueNames.join(", "));
        else if (venueName) filters.push(`${venueName}`);
        if (refereeName) filters.push(`Referee: ${refereeName}`);
        if (teamName) filters.push(`Team: ${teamName}`);
        break;
    }

    if (formatName) filters.push(`${formatName}`);

    return filters.length === 0 ? "All matches" : filters.join(" - ");
  };

  const handlePreviewPDF = async () => {
    try {
      setIsExportingPDF(true);
      // Drafts go across as cells rather than merged into gameScores: merging would drop the
      // blank boxes and renumber the rest, so the PDF would stop matching the sheet on screen.
      await previewMatchesPDFWithFilename(matches, viewType, tournamentName, {
        categoryName,
        venueName,
        venueNames,
        refereeName,
        teamName,
        formatName,
        scoreDrafts,
        qrLinks,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to preview PDF. Please try again.";
      alert(`PDF Preview Error: ${errorMessage}`);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const draftedCount = matches.filter((match) => {
    const draft = scoreDrafts[match.id];
    return draft?.some((cell) => cell.home !== null || cell.away !== null);
  }).length;

  // Decided once per report so every card agrees — the same rules the PDF uses.
  const sheetCategory = headerCategory(categoryName, matches);
  const cardMeta: CardMetaOptions = {
    showCategory: shouldLabelCategories(matches),
    showDate: reportSpansMultipleDays(matches),
    showCourt: !shouldGroupByVenue(viewType),
  };
  const pages = paginateSheets(matches, viewType, sheetSubjectTitle(viewType, { venueName, refereeName, teamName }));

  const renderBox = (match: Match, teamLabel: string, cell: ScoreCell, side: "home" | "away", width: string) => {
    const value = cell[side];
    const other = side === "home" ? cell.away : cell.home;
    const isEmpty = value === null;

    return (
      <div
        key={`${side}-${cell.gameNumber}`}
        className={`sheet-card__box${isEmpty ? " sheet-card__box--empty" : ""}`}
        style={{ width }}
      >
        {match.isCompleted ? (
          <span className={`score-cell-text${isCellWinner(value, other) ? " is-winner" : ""}`}>{isEmpty ? " " : value}</span>
        ) : (
          <input
            type="text"
            inputMode="numeric"
            maxLength={3}
            className="score-input"
            value={isEmpty ? "" : String(value)}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => updateScoreCell(match, cell.gameNumber, side, event.target.value)}
            aria-label={`${teamLabel} game ${cell.gameNumber}`}
          />
        )}
      </div>
    );
  };

  const renderTeamLine = (match: Match, side: "home" | "away", cells: ScoreCell[], width: string) => {
    const name =
      side === "home"
        ? sideDisplayName(match.homeTeamName, match.homeTeam2Name)
        : sideDisplayName(match.awayTeamName, match.awayTeam2Name);
    const members = formatMembers(side === "home" ? match.homeTeamMembers : match.awayTeamMembers);

    return (
      <div className="sheet-card__team">
        <div className="sheet-card__name">
          <span className="sheet-card__team-name">{name}</span>
          {members ? <span className="sheet-card__members">{members}</span> : null}
        </div>
        <div className="sheet-card__boxes">{cells.map((cell) => renderBox(match, name, cell, side, width))}</div>
      </div>
    );
  };

  const renderCard = (match: Match, position: number) => {
    const cells = cellsForMatch(match);
    const width = `${scoreCellWidth(cells.length)}pt`;
    const qr = qrLinks[match.id];
    const fixedPoints = isFixedPointsFormat(match.formatType);

    return (
      <article key={match.id} className={`sheet-card${matchIsLive(match) ? " sheet-card--live" : ""}`}>
        <div className="sheet-card__main">
          <div className="sheet-card__top">
            <span className="sheet-card__meta">{cardMetaItems(match, position, cardMeta).join("  ·  ")}</span>
            <span className="sheet-card__rule">{cardRuleLabel(match)}</span>
          </div>

          <div className="sheet-card__labels">
            {cells.map((cell) => (
              <span key={cell.gameNumber} className="sheet-card__label" style={{ width }}>
                {fixedPoints ? "Pts" : `G${cell.gameNumber}`}
              </span>
            ))}
          </div>

          {renderTeamLine(match, "home", cells, width)}
          <div className="sheet-card__divider" />
          {renderTeamLine(match, "away", cells, width)}

          <div className="sheet-card__referee">
            <span className="sheet-card__referee-label">Referees</span>
            <span className="sheet-card__referee-names">{formatReferees(match.referees)}</span>
          </div>
        </div>

        <div className="sheet-card__qr">
          {qr ? (
            <>
              <QRCode value={qr.url} level="M" size={256} className="sheet-card__qr-code" />
              <span className="sheet-card__qr-caption">{qrCaption(match)}</span>
              <span className="sheet-card__qr-expiry">Valid until {formatValidUntil(qr.expiresAt)}</span>
            </>
          ) : (
            <div className="sheet-card__qr-slot" aria-hidden="true" />
          )}
        </div>
      </article>
    );
  };

  const renderPage = (page: SheetPage, index: number) => (
    <section key={page.key} className="sheet-page">
      <header className="sheet-band">
        <span className="sheet-band__title">{page.title}</span>
        <span className="sheet-band__meta">
          {sheetMeta(tournamentName, sheetCategory, formatName, page.groupSize).map((item, itemIndex) => (
            <span key={`${itemIndex}-${item}`} className="sheet-band__meta-item">
              {item}
            </span>
          ))}
        </span>
      </header>

      <div className="sheet-body">
        {page.matches.length === 0 ? (
          <div className="sheet-empty">
            <h3>Nothing scheduled</h3>
            <p>No matches match the selected filters.</p>
          </div>
        ) : (
          page.matches.map((match, matchIndex) => renderCard(match, page.firstPosition + matchIndex))
        )}
      </div>

      <footer className="sheet-footer">
        <span>{tournamentName}</span>
        <span>{printedOnLabel()}</span>
        <span>
          Page {index + 1} of {pages.length}
        </span>
      </footer>
    </section>
  );

  return (
    <div className="printable-view">
      <div className="print-controls no-print">
        <div className="print-header">
          <h2>Export preview</h2>
          <p>
            {getViewTitle()}
            <span className="print-header__count">{matchCountLabel(matches.length)}</span>
          </p>
          {draftedCount > 0 && (
            <p className="entry-status" aria-live="polite">
              {draftedCount} of {matches.length} scored
            </p>
          )}
          {qrStatus === "loading" && (
            <p className="qr-status" aria-live="polite">
              Generating QR codes…
            </p>
          )}
          {qrStatus === "failed" && (
            <p className="qr-status qr-status--failed" role="alert">
              QR codes couldn't be generated — sheets will print without them.
              {onRetryQr ? (
                <button type="button" className="qr-retry-btn" onClick={onRetryQr}>
                  Retry
                </button>
              ) : null}
            </p>
          )}
        </div>

        <div className="print-actions">
          <button onClick={handlePreviewPDF} className="pdf-btn" disabled={isExportingPDF || qrStatus === "loading"}>
            {isExportingPDF ? "Opening..." : qrStatus === "loading" ? "Preparing QR codes…" : "Preview PDF"}
          </button>
          <button onClick={onClose} className="close-btn">
            Close preview
          </button>
        </div>
      </div>

      <div id="printable-content" className="printable-content" style={sheetCssVariables() as React.CSSProperties}>
        {pages.map(renderPage)}
      </div>
    </div>
  );
};

export default PrintableView;
