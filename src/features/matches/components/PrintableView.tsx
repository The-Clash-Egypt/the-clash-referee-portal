import React, { useState } from "react";
import { Match, sideDisplayName } from "../types/match";
import { previewMatchesPDFWithFilename } from "../../../utils/reactPdfExport";
import {
  UNASSIGNED_VENUE_LABEL,
  groupMatchesByVenue,
  shouldGroupByVenue,
} from "../../../utils/venueGrouping";
import {
  ScoreCell,
  isCellWinner,
  scoreCellWidth,
  scoreCellsFor,
} from "../../../utils/matchScoreCells";
import {
  dayKey,
  formatClock,
  formatDayLabel,
  formatMembers,
  formatReferees,
  headerCategory,
  shouldLabelCategories,
  matchIsLive,
  matchCountLabel,
  printedOnLabel,
  sheetMeta,
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
}

/** Scores typed into the sheet before printing, keyed by match id. */
type ScoreDrafts = Record<string, ScoreCell[]>;

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
}) => {
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [scoreDrafts, setScoreDrafts] = useState<ScoreDrafts>({});

  /**
   * Seeds from the match itself rather than an empty array. Seeding from `[]`
   * stored an empty grid, which then won the lookup in cellsForMatch and
   * unmounted the inputs on the first keystroke.
   */
  const cellsForMatch = (match: Match): ScoreCell[] => scoreDrafts[match.id] ?? scoreCellsFor(match);

  const updateScoreCell = (match: Match, gameNumber: number, side: "home" | "away", raw: string) => {
    const digits = raw.replace(/[^0-9]/g, "").slice(0, 3);
    const value = digits === "" ? null : parseInt(digits, 10);

    setScoreDrafts((previous) => {
      const base = previous[match.id] ?? scoreCellsFor(match);
      return {
        ...previous,
        [match.id]: base.map((cell) =>
          cell.gameNumber === gameNumber ? { ...cell, [side]: value } : cell
        ),
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
      // The drafts go across as cells rather than merged into gameScores: merging
      // would drop the blank boxes and renumber the rest, so the PDF would stop
      // matching the sheet on screen.
      await previewMatchesPDFWithFilename(matches, viewType, tournamentName, {
        categoryName,
        venueName,
        venueNames,
        refereeName,
        teamName,
        formatName,
        scoreDrafts,
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

  const renderScoreGrid = (match: Match) => {
    const cells = cellsForMatch(match);
    const width = `${scoreCellWidth(cells.length)}pt`;
    const hasResult = match.homeScore !== undefined && match.awayScore !== undefined;

    const renderCell = (cell: ScoreCell, side: "home" | "away") => {
      const value = cell[side];
      const other = side === "home" ? cell.away : cell.home;
      const isEmpty = value === null;

      return (
        <div
          key={`${side}-${cell.gameNumber}`}
          className={`score-grid__cell${isEmpty ? " score-grid__cell--empty" : ""}`}
          style={{ width }}
        >
          {match.isCompleted ? (
            <span className={`score-cell-text${isCellWinner(value, other) ? " is-winner" : ""}`}>
              {isEmpty ? " " : value}
            </span>
          ) : (
            <input
              type="text"
              inputMode="numeric"
              maxLength={3}
              className={`score-input ${side}-score`}
              value={isEmpty ? "" : String(value)}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => updateScoreCell(match, cell.gameNumber, side, event.target.value)}
              aria-label={`Game ${cell.gameNumber} ${side} score`}
            />
          )}
        </div>
      );
    };

    return (
      <>
        <div className="score-grid">
          <div className="score-grid__row">{cells.map((cell) => renderCell(cell, "home"))}</div>
          <div className="score-grid__row">{cells.map((cell) => renderCell(cell, "away"))}</div>
        </div>
        {match.isCompleted && hasResult ? (
          <span className="score-display">
            {match.homeScore} &ndash; {match.awayScore}
          </span>
        ) : (
          <span className="score-caption">Best of {Math.max(match.bestOf || 1, 1)}</span>
        )}
      </>
    );
  };

  // Decided once for the whole report so every sheet agrees: the category goes
  // either in each header or on each row, never both and never neither.
  const showCategory = shouldLabelCategories(matches);
  const sheetCategory = headerCategory(categoryName, matches);

  const renderMatchRow = (match: Match, position: number, shade: boolean) => {
    const homeMembers = formatMembers(match.homeTeamMembers);
    const awayMembers = formatMembers(match.awayTeamMembers);

    return (
      <tr
        key={match.id}
        className={`match-row${shade ? " match-row--alt" : ""}${matchIsLive(match) ? " match-row--live" : ""}`}
      >
        <td className="rail">
          <span className="match-number">{position}</span>
          <span className="time">{formatClock(match.startTime)}</span>
          {match.round ? <span className="round">{match.round}</span> : null}
          {showCategory && match.categoryName ? (
            <span className="category">{match.categoryName}</span>
          ) : null}
        </td>

        <td className="fixture">
          <span className="team-name">{sideDisplayName(match.homeTeamName, match.homeTeam2Name)}</span>
          {homeMembers ? <span className="team-members">{homeMembers}</span> : null}
          <span className="versus">v</span>
          <span className="team-name">{sideDisplayName(match.awayTeamName, match.awayTeam2Name)}</span>
          {awayMembers ? <span className="team-members">{awayMembers}</span> : null}
          <span className="referee-line">
            <span className="referee-label">Referees</span>
            <span className="referee-names">{formatReferees(match.referees)}</span>
          </span>
        </td>

        <td className="score">{renderScoreGrid(match)}</td>
      </tr>
    );
  };

  const renderSchedule = (sheetMatches: Match[]) => {
    let lastDay = "";

    return sheetMatches.map((match, index) => {
      const key = dayKey(match);
      const startsNewDay = key !== lastDay;
      lastDay = key;

      return (
        <React.Fragment key={match.id}>
          {startsNewDay && (
            <tr className="day-row">
              <td colSpan={3}>{formatDayLabel(match.startTime)}</td>
            </tr>
          )}
          {renderMatchRow(match, index + 1, index % 2 === 1)}
        </React.Fragment>
      );
    });
  };

  /**
   * One sheet per venue. A real table, because `thead { display: table-header-group }`
   * is the only way a browser repeats the venue band on every printed page — the
   * same job `fixed` does for the PDF's running header.
   */
  const renderSheet = (key: string, title: string, sheetMatches: Match[], newPage: boolean) => (
    <section key={key} className={`venue-section${newPage ? " venue-section--new-page" : ""}`}>
      <table className="sheet">
        <colgroup>
          <col className="col-rail" />
          <col className="col-fixture" />
          <col className="col-score" />
        </colgroup>

        <thead className="sheet-head">
          <tr className="sheet-band">
            <th colSpan={3}>
              <span className="venue-section-title">{title}</span>
              <span className="sheet-meta">
                {sheetMeta(tournamentName, sheetCategory, formatName, sheetMatches.length).map((item, index) => (
                  <span key={`${index}-${item}`} className="sheet-meta__item">
                    {item}
                  </span>
                ))}
              </span>
            </th>
          </tr>
          <tr className="sheet-colhead">
            <th className="col-time">Time</th>
            <th className="col-match">Match</th>
            <th className="col-score">Score</th>
          </tr>
        </thead>

        <tbody>
          {sheetMatches.length === 0 ? (
            <tr>
              <td colSpan={3} className="no-matches-print">
                <h3>Nothing scheduled</h3>
                <p>No matches match the selected filters.</p>
              </td>
            </tr>
          ) : (
            renderSchedule(sheetMatches)
          )}
        </tbody>

        <tfoot className="print-footer">
          <tr>
            <td colSpan={3}>
              <div className="print-footer__inner">
                <span>{tournamentName}</span>
                <span>{printedOnLabel()}</span>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </section>
  );

  const renderSheets = () => {
    if (shouldGroupByVenue(viewType)) {
      const groups = groupMatchesByVenue(matches);

      if (groups.length === 0) {
        return renderSheet("empty", venueName || "All venues", [], false);
      }

      return groups.map((group, index) =>
        renderSheet(
          group.venue,
          group.venue === UNASSIGNED_VENUE_LABEL ? UNASSIGNED_VENUE_LABEL : group.venue,
          group.matches,
          index > 0
        )
      );
    }

    const subject = viewType === "referee" ? refereeName : teamName;
    return renderSheet("single", subject || "Matches", matches, false);
  };

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
        </div>

        <div className="print-actions">
          <button onClick={handlePreviewPDF} className="pdf-btn" disabled={isExportingPDF}>
            {isExportingPDF ? "Opening..." : "Preview PDF"}
          </button>
          <button onClick={onClose} className="close-btn">
            Close preview
          </button>
        </div>
      </div>

      <div id="printable-content" className="printable-content">
        <div className="matches-print-section">{renderSheets()}</div>
      </div>
    </div>
  );
};

export default PrintableView;
