import React from "react";
import { Match } from "../types/match";

interface PrintableViewProps {
  matches: Match[];
  tournamentName: string;
  categoryName?: string;
  venueName?: string;
  refereeName?: string;
  teamName?: string;
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
  viewType,
  onClose,
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

  const getViewTitle = () => {
    switch (viewType) {
      case "venue":
        return venueName ? `Venue: ${venueName}` : "All Venues";
      case "referee":
        return refereeName ? `Referee: ${refereeName}` : "All Referees";
      case "team":
        return teamName ? `Team: ${teamName}` : "All Teams";
      default:
        return "Matches Report";
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div className="printable-view">
      {/* Print Controls - Hidden when printing */}
      <div className="print-controls no-print">
        <div className="print-header">
          <h2>Print Preview</h2>
          <p>Review the document before printing. Use your browser's print function (Ctrl+P / Cmd+P) to print.</p>
        </div>
        <div className="print-actions">
          <button onClick={handlePrint} className="print-btn">
            Print Document
          </button>
          <button onClick={handleClose} className="close-btn">
            Close Preview
          </button>
        </div>
      </div>

      {/* Printable Content */}
      <div className="printable-content">
        {/* Header */}
        <div className="print-header-section">
          <h1 className="tournament-title">{tournamentName}</h1>
          <h2 className="view-title">{getViewTitle()}</h2>
          {categoryName && <h3 className="category-title">Category: {categoryName}</h3>}
          <div className="print-meta">
            <p>Generated on: {new Date().toLocaleString()}</p>
            <p>Total Matches: {matches.length}</p>
          </div>
        </div>

        {/* Matches List */}
        <div className="matches-print-section">
          {matches.length === 0 ? (
            <div className="no-matches-print">
              <p>No matches found for the selected criteria.</p>
            </div>
          ) : (
            matches.map((match, index) => (
              <div key={match.id} className="match-print-item">
                <div className="match-header">
                  <h3>Match {index + 1}</h3>
                </div>

                <div className="match-details">
                  <div className="match-teams">
                    <strong>{match.homeTeamName || "TBD"}</strong> vs <strong>{match.awayTeamName || "TBD"}</strong>
                  </div>

                  <div className="match-info-grid">
                    <div className="info-item">
                      <span className="label">Venue:</span>
                      <span className="value">{match.venue || "TBD"}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Round:</span>
                      <span className="value">{match.round || "TBD"}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Format:</span>
                      <span className="value">{match.format || "TBD"}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Time:</span>
                      <span className="value">{formatTime(match.startTime)}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Referee(s):</span>
                      <span className="value">{getRefereesList(match.referees)}</span>
                    </div>
                  </div>

                  {/* Score Section */}
                  <div className="score-section">
                    <h4>Score Information</h4>
                    <div className="current-score">
                      <span className="label">Current Score:</span>
                      <span className="value">{formatScore(match)}</span>
                    </div>

                    {/* Game Scores */}
                    {match.gameScores && match.gameScores.length > 0 && (
                      <div className="game-scores">
                        <h5>Game Scores:</h5>
                        <div className="scores-grid">
                          {match.gameScores.map((gameScore, gameIndex) => (
                            <div key={gameIndex} className="game-score-item">
                              <span className="game-label">Game {gameScore.gameNumber}:</span>
                              <span className="game-score">
                                {gameScore.homeScore} - {gameScore.awayScore}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
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
