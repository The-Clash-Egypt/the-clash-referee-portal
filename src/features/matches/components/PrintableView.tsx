import React, { useState } from "react";
import { Match, MatchGameScore } from "../types/match";
import { exportMatchesToPDFWithFilename } from "../../../utils/reactPdfExport";

interface PrintableViewProps {
  matches: Match[];
  tournamentName: string;
  categoryName?: string;
  venueName?: string;
  refereeName?: string;
  teamName?: string;
  formatName?: string;
  viewType: "venue" | "referee" | "team" | "general";
  onClose: () => void;
}

const PrintableView: React.FC<PrintableViewProps> = ({
  matches,
  tournamentName,
  categoryName,
  venueName,
  refereeName,
  teamName,
  formatName,
  viewType,
  onClose,
}) => {
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [matchGameScores, setMatchGameScores] = useState<{ [matchId: string]: MatchGameScore[] }>({});
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
    return match.homeScore !== undefined && match.awayScore !== undefined
      ? `${match.homeScore}-${match.awayScore}`
      : "TBD";
  };

  const getRefereesList = (referees?: any[]) => {
    if (!referees || referees.length === 0) return "Unassigned";
    return referees.map((ref) => ref.fullName || ref.name || "Unknown").join(", ");
  };

  const getBestOfValue = (match: Match): number => {
    return match.bestOf || 1;
  };

  const getGameScoresForMatch = (match: Match): MatchGameScore[] => {
    if (matchGameScores[match.id]) {
      return matchGameScores[match.id];
    }
    if (match.gameScores && match.gameScores.length > 0) {
      return match.gameScores;
    }
    // Initialize with empty game scores based on best of
    const bestOf = getBestOfValue(match);
    return Array.from({ length: bestOf }, (_, index) => ({
      gameNumber: index + 1,
      homeScore: 0,
      awayScore: 0,
    }));
  };

  const updateGameScore = (matchId: string, gameNumber: number, field: "homeScore" | "awayScore", value: string) => {
    const numericValue = value === "" ? 0 : Math.max(0, parseInt(value) || 0);
    setMatchGameScores((prev) => {
      const currentScores = prev[matchId] || [];
      const updatedScores = currentScores.map((score) =>
        score.gameNumber === gameNumber ? { ...score, [field]: numericValue } : score
      );
      return { ...prev, [matchId]: updatedScores };
    });
  };

  const canAddMoreGames = (match: Match): boolean => {
    const bestOf = getBestOfValue(match);
    const currentScores = getGameScoresForMatch(match);

    // Check if match is already decided
    const homeWins = currentScores.filter((score) => score.homeScore > score.awayScore).length;
    const awayWins = currentScores.filter((score) => score.homeScore < score.awayScore).length;
    const setsNeededToWin = Math.ceil(bestOf / 2);

    if (homeWins >= setsNeededToWin || awayWins >= setsNeededToWin) {
      return false;
    }
    return currentScores.length < bestOf;
  };

  const addGame = (match: Match) => {
    const currentScores = getGameScoresForMatch(match);
    const nextGameNumber = currentScores.length + 1;
    const newScore: MatchGameScore = {
      gameNumber: nextGameNumber,
      homeScore: 0,
      awayScore: 0,
    };

    setMatchGameScores((prev) => ({
      ...prev,
      [match.id]: [...currentScores, newScore],
    }));
  };

  const getViewTitle = () => {
    const filters = [];

    // Add primary filter based on view type
    switch (viewType) {
      case "venue":
        if (venueName) filters.push(`${venueName}`);
        break;
      case "referee":
        if (refereeName) filters.push(`Referee: ${refereeName}`);
        break;
      case "team":
        if (teamName) filters.push(`Team: ${teamName}`);
        break;
      default:
        // For general view, show all active filters
        if (venueName) filters.push(`${venueName}`);
        if (refereeName) filters.push(`Referee: ${refereeName}`);
        if (teamName) filters.push(`Team: ${teamName}`);
        break;
    }

    // Add additional filters
    if (formatName) filters.push(`${formatName}`);

    // If no filters, return default title
    if (filters.length === 0) {
      return "Matches Report";
    }

    // Join all filters with " - "
    return filters.join(" - ");
  };

  const handleClose = () => {
    onClose();
  };

  const handleExportPDF = async () => {
    try {
      setIsExportingPDF(true);

      // Use the new React PDF export
      await exportMatchesToPDFWithFilename(matches, viewType, tournamentName, {
        categoryName,
        venueName,
        refereeName,
        teamName,
        formatName,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to export PDF. Please try again.";
      alert(`PDF Export Error: ${errorMessage}`);
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="printable-view">
      {/* Print Controls - Hidden when printing */}
      <div className="print-controls no-print">
        <div className="print-header">
          <h2>Export Preview</h2>
          <p>Review the document before exporting to PDF.</p>
        </div>
        <div className="print-actions">
          <button onClick={handleExportPDF} className="pdf-btn" disabled={isExportingPDF}>
            {isExportingPDF ? "Exporting..." : "Export PDF"}
          </button>
          <button onClick={handleClose} className="close-btn">
            Close Preview
          </button>
        </div>
      </div>

      {/* Printable Content */}
      <div id="printable-content" className="printable-content">
        {/* Header */}
        <div className="print-header-section">
          <h1 className="tournament-title">{tournamentName}</h1>
          <h2 className="view-title">{getViewTitle()}</h2>
          {categoryName && <h3 className="category-title">{categoryName}</h3>}
        </div>

        {/* Matches List */}
        <div className="matches-print-section">
          {matches.length === 0 ? (
            <div className="no-matches-print">
              <div className="empty-state-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </div>
              <h3>No Matches Found</h3>
              <p>No matches found for the selected criteria.</p>
            </div>
          ) : (
            <div className="matches-grid">
              {matches.map((match, index) => (
                <div key={match.id} className="match-card">
                  <div className="match-card-header">
                    <div className="match-number">#{index + 1}</div>
                    <div className="match-status">
                      {match.isCompleted ? (
                        <span className="status-badge completed">Completed</span>
                      ) : match.startTime && new Date(match.startTime) <= new Date() ? (
                        <span className="status-badge in-progress">In Progress</span>
                      ) : (
                        <span className="status-badge upcoming">Upcoming</span>
                      )}
                    </div>
                  </div>

                  {/* Match Information - Center Aligned */}
                  <div className="match-info-simple">
                    <div className="info-item">
                      <span className="info-value">{match.round || "TBD"}</span>
                    </div>

                    <div className="info-item">
                      <span className="info-value">{formatTime(match.startTime)}</span>
                    </div>

                    <div className="info-item">
                      <span className="info-value">{match.venue || "TBD"}</span>
                    </div>

                    <div className="info-item teams-scores">
                      <div className="teams-row">
                        <span className="team-name">{match.homeTeamName || "TBD"}</span>
                        <span className="score-display">{formatScore(match)}</span>
                        <span className="team-name">{match.awayTeamName || "TBD"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Referees - Original Design */}
                  <div className="match-referees">
                    <div className="referees-display">
                      <svg className="referees-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z" />
                      </svg>
                      <span className="referees-text">{getRefereesList(match.referees)}</span>
                    </div>
                  </div>

                  {/* Game Scores */}
                  {!match.isCompleted ? (
                    <div className="game-scores-section">
                      <div className="game-scores-header">
                        <h4>Game Scores (Best of {getBestOfValue(match)})</h4>
                        {canAddMoreGames(match) && (
                          <button className="add-game-btn" onClick={() => addGame(match)} type="button">
                            + Add Game
                          </button>
                        )}
                      </div>
                      <div className="game-scores-grid">
                        {getGameScoresForMatch(match).map((gameScore, gameIndex) => (
                          <div key={gameIndex} className="game-score-card">
                            <span className="game-number">Game {gameScore.gameNumber}</span>
                            <div className="game-score-inputs">
                              <input
                                type="text"
                                onChange={(e) =>
                                  updateGameScore(match.id, gameScore.gameNumber, "homeScore", e.target.value)
                                }
                                className="score-input home-score"
                              />
                              <span className="score-separator">-</span>
                              <input
                                type="text"
                                onChange={(e) =>
                                  updateGameScore(match.id, gameScore.gameNumber, "awayScore", e.target.value)
                                }
                                className="score-input away-score"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : match.gameScores && match.gameScores.length > 0 ? (
                    <div className="game-scores-section">
                      <h4>Game Scores</h4>
                      <div className="game-scores-grid">
                        {match.gameScores.map((gameScore, gameIndex) => (
                          <div key={gameIndex} className="game-score-card">
                            <span className="game-number">Game {gameScore.gameNumber}</span>
                            <span className="game-score">
                              {gameScore.homeScore} - {gameScore.awayScore}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="print-footer">
          <p>The Clash Referee Portal - {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  );
};

export default PrintableView;
