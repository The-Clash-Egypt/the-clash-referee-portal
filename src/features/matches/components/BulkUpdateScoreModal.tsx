import React, { useState, useEffect } from "react";
import { Match, MatchGameScore } from "../types/match";
import "./BulkUpdateScoreModal.scss";

interface BulkUpdateScoreModalProps {
  isOpen: boolean;
  selectedMatches: Match[];
  onClose: () => void;
  onSubmit: (matchScores: { matchId: string; gameScores: MatchGameScore[] }[]) => Promise<void>;
  loading: boolean;
}

const BulkUpdateScoreModal: React.FC<BulkUpdateScoreModalProps> = ({
  isOpen,
  selectedMatches,
  onClose,
  onSubmit,
  loading,
}) => {
  const [matchScores, setMatchScores] = useState<{ matchId: string; gameScores: MatchGameScore[] }[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [showSummary, setShowSummary] = useState<boolean>(false);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    // Cleanup function to restore scrolling when component unmounts
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Initialize match scores when selected matches change
  useEffect(() => {
    if (selectedMatches.length > 0) {
      const initialScores = selectedMatches.map((match) => ({
        matchId: match.id,
        gameScores:
          match.gameScores && match.gameScores.length > 0
            ? match.gameScores.map((score) => ({
                ...score,
                homeScore: score.homeScore || 0,
                awayScore: score.awayScore || 0,
              }))
            : [{ gameNumber: 1, homeScore: 0, awayScore: 0 }],
      }));
      setMatchScores(initialScores);
      setErrors([]);
      setCurrentStep(0);
      setShowSummary(false);
    }
  }, [selectedMatches]);

  const getBestOfValue = (match: Match): number => {
    if (match.bestOf) {
      return match.bestOf;
    }
    return 1;
  };

  const updateGameScore = (matchId: string, gameNumber: number, field: "homeScore" | "awayScore", value: string) => {
    const numericValue = value === "" ? 0 : Math.max(0, parseInt(value) || 0);
    setMatchScores((prev) =>
      prev.map((matchScore) =>
        matchScore.matchId === matchId
          ? {
              ...matchScore,
              gameScores: matchScore.gameScores.map((score) =>
                score.gameNumber === gameNumber ? { ...score, [field]: numericValue } : score
              ),
            }
          : matchScore
      )
    );
  };

  const addGame = (matchId: string) => {
    setMatchScores((prev) =>
      prev.map((matchScore) =>
        matchScore.matchId === matchId
          ? {
              ...matchScore,
              gameScores: [
                ...matchScore.gameScores,
                {
                  gameNumber: matchScore.gameScores.length + 1,
                  homeScore: 0,
                  awayScore: 0,
                },
              ],
            }
          : matchScore
      )
    );
  };

  const removeGame = (matchId: string, gameNumber: number) => {
    setMatchScores((prev) =>
      prev.map((matchScore) =>
        matchScore.matchId === matchId
          ? {
              ...matchScore,
              gameScores: matchScore.gameScores.filter((score) => score.gameNumber !== gameNumber),
            }
          : matchScore
      )
    );
  };

  const validateScores = (): boolean => {
    const newErrors: string[] = [];

    matchScores.forEach((matchScore) => {
      const match = selectedMatches.find((m) => m.id === matchScore.matchId);
      if (!match) return;

      // Only validate matches that have scores entered
      const hasPlayedGames = matchScore.gameScores.some((score) => score.homeScore > 0 || score.awayScore > 0);

      if (hasPlayedGames) {
        // Check for valid game outcomes (no ties in most sports) only for games with scores
        matchScore.gameScores.forEach((score, index) => {
          if (score.homeScore > 0 || score.awayScore > 0) {
            if (score.homeScore === score.awayScore) {
              newErrors.push(
                `${match.homeTeamName} vs ${match.awayTeamName} - Game ${index + 1}: Cannot end in a tie.`
              );
            }
          }
        });
      }
    });

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleNext = () => {
    if (currentStep < selectedMatches.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      if (validateScores()) {
        setShowSummary(true);
      }
    }
  };

  const handlePrevious = () => {
    if (showSummary) {
      setShowSummary(false);
    } else if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleBackToScores = () => {
    setShowSummary(false);
  };

  const handleSubmit = async () => {
    if (!validateScores()) {
      return;
    }

    // Only include matches that have played games
    const matchesWithScores = matchScores
      .map((matchScore) => ({
        matchId: matchScore.matchId,
        gameScores: matchScore.gameScores.filter((score) => score.homeScore > 0 || score.awayScore > 0),
      }))
      .filter((matchScore) => matchScore.gameScores.length > 0);

    try {
      await onSubmit(matchesWithScores);
      onClose();
    } catch (error) {
      console.error("Error updating scores:", error);
    }
  };

  const handleClose = () => {
    setMatchScores([]);
    setErrors([]);
    setCurrentStep(0);
    setShowSummary(false);
    onClose();
  };

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString);
    return date.toLocaleString();
  };

  if (!isOpen || selectedMatches.length === 0) return null;

  const currentMatch = selectedMatches[currentStep];
  const currentMatchScores = matchScores.find((ms) => ms.matchId === currentMatch.id)?.gameScores || [];
  const completedMatches = matchScores.filter((ms) =>
    ms.gameScores.some((score) => score.homeScore > 0 || score.awayScore > 0)
  ).length;

  return (
    <div className="bulk-update-score-modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Bulk Update Scores</h3>
          <button className="modal-close" onClick={handleClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* Progress Header */}
          <div className="progress-header">
            <div className="progress-info">
              <span className="step-indicator">
                {showSummary ? "Review" : `Match ${currentStep + 1} of ${selectedMatches.length}`}
              </span>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: showSummary ? "100%" : `${((currentStep + 1) / selectedMatches.length) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
            <div className="completion-stats">
              <span className="completed-count">{completedMatches}</span>
              <span className="total-count">/ {selectedMatches.length}</span>
              <span className="completed-label">matches with scores</span>
            </div>
          </div>

          {showSummary ? (
            /* Summary View */
            <div className="summary-view">
              <h4>Review Scores Before Submitting</h4>
              <div className="summary-matches">
                {matchScores
                  .filter((ms) => ms.gameScores.some((score) => score.homeScore > 0 || score.awayScore > 0))
                  .map((matchScore) => {
                    const match = selectedMatches.find((m) => m.id === matchScore.matchId);
                    if (!match) return null;

                    const playedGames = matchScore.gameScores.filter(
                      (score) => score.homeScore > 0 || score.awayScore > 0
                    );

                    return (
                      <div key={match.id} className="summary-match">
                        <div className="match-header">
                          <h5>
                            {match.homeTeamName} vs {match.awayTeamName}
                          </h5>
                          <span className="match-format">{match.format || "Best of 1"}</span>
                        </div>
                        <div className="match-scores">
                          {playedGames.map((score) => (
                            <div key={score.gameNumber} className="game-summary">
                              <span className="game-label">Game {score.gameNumber}:</span>
                              <span className="score-display">
                                {score.homeScore} - {score.awayScore}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            /* Score Entry View */
            <>
              <div className="match-info">
                <h4>Match Details</h4>
                <p>
                  <strong>Teams:</strong> {currentMatch.homeTeamName} vs {currentMatch.awayTeamName}
                </p>
                <p>
                  <strong>Format:</strong> {currentMatch.format || "Best of 1"}
                </p>
                <p>
                  <strong>Venue:</strong> {currentMatch.venue || "TBD"}
                </p>
                <p>
                  <strong>Time:</strong> {currentMatch.startTime ? formatDateTime(currentMatch.startTime) : "TBD"}
                </p>
              </div>

              <div className="score-section">
                <h4>Game Scores</h4>
                <p className="score-instructions">
                  Enter scores for each game. Leave empty if the game hasn't been played yet. You can skip matches
                  without scores - only matches with entered scores will be updated.
                </p>

                <div className="games-grid">
                  {currentMatchScores.map((score, index) => (
                    <div key={score.gameNumber} className="game-score-card">
                      <div className="game-header">
                        <h5>Game {score.gameNumber}</h5>
                        {currentMatchScores.length > 1 && (
                          <button
                            className="remove-game-btn"
                            onClick={() => removeGame(currentMatch.id, score.gameNumber)}
                            type="button"
                            title="Remove game"
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <div className="score-inputs">
                        <div className="team-score">
                          <label>{currentMatch.homeTeamName}</label>
                          <input
                            type="number"
                            min="0"
                            value={score.homeScore === 0 ? "" : score.homeScore}
                            onChange={(e) =>
                              updateGameScore(currentMatch.id, score.gameNumber, "homeScore", e.target.value)
                            }
                            className="score-input"
                          />
                        </div>
                        <div className="score-divider"></div>
                        <div className="team-score">
                          <label>{currentMatch.awayTeamName}</label>
                          <input
                            type="number"
                            min="0"
                            value={score.awayScore === 0 ? "" : score.awayScore}
                            onChange={(e) =>
                              updateGameScore(currentMatch.id, score.gameNumber, "awayScore", e.target.value)
                            }
                            className="score-input"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {currentMatchScores.length < getBestOfValue(currentMatch) && (
                  <div className="add-game-section">
                    <button className="add-game-btn" onClick={() => addGame(currentMatch.id)} type="button">
                      + Add Game
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {errors.length > 0 && (
            <div className="error-messages">
              <h4>Validation Errors:</h4>
              {errors.map((error, index) => (
                <p key={index} className="error-message">
                  {error}
                </p>
              ))}
            </div>
          )}

          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={handleClose} disabled={loading}>
              Cancel
            </button>

            {!showSummary && (
              <div className="navigation-buttons">
                <button className="btn btn-secondary" onClick={handlePrevious} disabled={currentStep === 0 || loading}>
                  Previous
                </button>
                <button className="btn btn-primary" onClick={handleNext} disabled={loading}>
                  {currentStep === selectedMatches.length - 1 ? "Review & Submit" : "Next Match"}
                </button>
              </div>
            )}

            {showSummary && (
              <div className="summary-actions">
                <button className="btn btn-secondary" onClick={handleBackToScores} disabled={loading}>
                  Back to Scores
                </button>
                <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                  {loading
                    ? "Updating..."
                    : `Update ${completedMatches} Match${completedMatches !== 1 ? "es" : ""} with Scores`}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkUpdateScoreModal;
