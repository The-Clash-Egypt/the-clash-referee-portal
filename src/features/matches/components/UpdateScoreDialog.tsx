import React, { useState, useEffect } from "react";
import { Match, MatchGameScore } from "../types/match";
import "./UpdateScoreDialog.scss";

interface UpdateScoreDialogProps {
  isOpen: boolean;
  match: Match | null;
  onClose: () => void;
  onSubmit: (gameScores: MatchGameScore[]) => Promise<void>;
  loading: boolean;
}

const UpdateScoreDialog: React.FC<UpdateScoreDialogProps> = ({ isOpen, match, onClose, onSubmit, loading }) => {
  const [gameScores, setGameScores] = useState<MatchGameScore[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedSetIndex, setSelectedSetIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Initialize game scores when match changes
  useEffect(() => {
    if (match) {
      const initialScores: MatchGameScore[] = [];

      if (match.gameScores && match.gameScores.length > 0) {
        initialScores.push(...match.gameScores);
      }

      if (initialScores.length === 0) {
        initialScores.push({
          gameNumber: 1,
          homeScore: 0,
          awayScore: 0,
        });
      }

      setGameScores(initialScores);
      setErrors([]);
      setSelectedSetIndex(0);
    }
  }, [match]);

  const getBestOfValue = (match: Match): number => {
    return match.bestOf || 1;
  };

  const canAddMoreSets = (): boolean => {
    if (!match) return false;
    const bestOf = getBestOfValue(match);
    // For best of N, we can have up to N games
    // We can add more games if we haven't reached the maximum possible games
    // Check if match is already decided (one team has won majority of sets)
    const homeWins = gameScores.filter((score) => score.homeScore > score.awayScore).length;
    const awayWins = gameScores.filter((score) => score.homeScore < score.awayScore).length;
    const setsNeededToWin = Math.ceil(bestOf / 2);

    // If either team has already won the required number of sets, don't allow more games
    if (homeWins >= setsNeededToWin || awayWins >= setsNeededToWin) {
      return false;
    }
    return gameScores.length < bestOf;
  };

  const isBestOfOne = (match: Match): boolean => {
    return getBestOfValue(match) === 1;
  };

  const updateGameScore = (gameNumber: number, field: "homeScore" | "awayScore", value: string) => {
    const numericValue = value === "" ? 0 : Math.max(0, parseInt(value) || 0);
    setGameScores((prev) =>
      prev.map((score) => (score.gameNumber === gameNumber ? { ...score, [field]: numericValue } : score))
    );
  };

  const quickUpdateScore = (team: "home" | "away", action: "add" | "subtract") => {
    const currentGame = gameScores[selectedSetIndex];
    if (!currentGame) return;

    const currentScore = team === "home" ? currentGame.homeScore : currentGame.awayScore;
    const newScore = action === "add" ? currentScore + 1 : Math.max(0, currentScore - 1);

    updateGameScore(currentGame.gameNumber, `${team}Score` as "homeScore" | "awayScore", newScore.toString());
  };

  const addGame = () => {
    const nextGameNumber = gameScores.length + 1;
    setGameScores((prev) => [
      ...prev,
      {
        gameNumber: nextGameNumber,
        homeScore: 0,
        awayScore: 0,
      },
    ]);

    // In fullscreen mode, automatically select the newly added game
    if (isFullscreen) {
      setSelectedSetIndex(nextGameNumber - 1);
    }
  };

  const removeGame = (gameNumber: number) => {
    setGameScores((prev) => prev.filter((score) => score.gameNumber !== gameNumber));
  };

  const validateScores = (): boolean => {
    const newErrors: string[] = [];

    const hasPlayedGames = gameScores.some((score) => score.homeScore > 0 || score.awayScore > 0);
    if (!hasPlayedGames) {
      newErrors.push("At least one game must have scores entered.");
    }

    gameScores.forEach((score, index) => {
      if (score.homeScore > 0 || score.awayScore > 0) {
        if (score.homeScore === score.awayScore) {
          newErrors.push(`Game ${index + 1} cannot end in a tie.`);
        }
      }
    });

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = async () => {
    if (!validateScores()) {
      return;
    }

    const playedGames = gameScores.filter((score) => score.homeScore > 0 || score.awayScore > 0);

    try {
      await onSubmit(playedGames);
      onClose();
    } catch (error) {
      console.error("Error updating scores:", error);
    }
  };

  const handleClose = () => {
    setGameScores([]);
    setErrors([]);
    setIsFullscreen(false);
    setSelectedSetIndex(0);
    onClose();
  };

  const exitFullscreen = () => {
    setIsFullscreen(false);
  };

  if (!isOpen || !match) return null;

  // Only count completed sets (sets that have been played)
  const completedSets = gameScores.filter((score) => score.homeScore > 0 || score.awayScore > 0);
  const homeWins = completedSets.filter((score) => score.homeScore > score.awayScore).length;
  const awayWins = completedSets.filter((score) => score.awayScore > score.homeScore).length;
  const currentGame = gameScores[selectedSetIndex] || { gameNumber: 1, homeScore: 0, awayScore: 0 };

  // Fullscreen Scoreboard View (Mobile Only)
  if (isFullscreen && isMobile) {
    return (
      <div className="fullscreen-scoreboard">
        <div className="scoreboard-content">
          {/* Header */}
          <div className="scoreboard-header">
            <button className="back-btn" onClick={exitFullscreen}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>

            {/* Set Selector in Header */}
            <div className="header-set-selector">
              {gameScores.map((score, index) => (
                <button
                  key={index}
                  className={`set-tab ${index === selectedSetIndex ? "active" : ""} ${
                    score.homeScore > 0 || score.awayScore > 0 ? "completed" : ""
                  }`}
                  onClick={() => setSelectedSetIndex(index)}
                >
                  Set {score.gameNumber}
                </button>
              ))}
            </div>
          </div>

          {/* Scoreboard */}
          <div className="scoreboard-main">
            <div className="team-section home">
              <div className="team-name">{match.homeTeamName}</div>
              <div className="score-display">{currentGame.homeScore}</div>
              <div className="score-controls">
                <button className="score-btn add" onClick={() => quickUpdateScore("home", "add")}>
                  +
                </button>
                <button
                  className="score-btn subtract"
                  onClick={() => quickUpdateScore("home", "subtract")}
                  disabled={currentGame.homeScore === 0}
                >
                  -
                </button>
              </div>
            </div>

            <div className="team-section away">
              <div className="team-name">{match.awayTeamName}</div>
              <div className="score-display">{currentGame.awayScore}</div>
              <div className="score-controls">
                <button className="score-btn add" onClick={() => quickUpdateScore("away", "add")}>
                  +
                </button>
                <button
                  className="score-btn subtract"
                  onClick={() => quickUpdateScore("away", "subtract")}
                  disabled={currentGame.awayScore === 0}
                >
                  -
                </button>
              </div>
            </div>
          </div>

          {/* Match Progress */}
          {!isBestOfOne(match) && (
            <div className="match-progress">
              <div className="progress-item">
                <span className="label">Home Wins</span>
                <span className="value">{homeWins}</span>
              </div>
              <div className="progress-item">
                <span className="label">Sets</span>
                <span className="value">
                  {completedSets.length}/{getBestOfValue(match)}
                </span>
              </div>
              <div className="progress-item">
                <span className="label">Away Wins</span>
                <span className="value">{awayWins}</span>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="save-section">
            {!isBestOfOne(match) && canAddMoreSets() && (
              <button className="add-game-btn" onClick={addGame}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" />
                </svg>
                Add Set {gameScores.length + 1}
              </button>
            )}
            <button className="save-btn" onClick={handleSubmit} disabled={loading}>
              {loading ? "Saving..." : "Save Scores"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Regular Modal View
  return (
    <div className="update-score-modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-content">
            <h3>Enter Match Scores</h3>
            <p className="match-teams">
              {match.homeTeamName} vs {match.awayTeamName}
            </p>
            <div className="match-info">
              <span className="best-of-badge">Best of {getBestOfValue(match)}</span>
              {!isBestOfOne(match) && (
                <span className="sets-progress">
                  {completedSets.length} of {getBestOfValue(match)} sets completed
                </span>
              )}
            </div>
          </div>
          <div className="header-actions">
            {/* Show fullscreen button only on mobile */}
            {isMobile && (
              <button
                className="fullscreen-toggle"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFullscreen(true);
                }}
                title="Enter fullscreen scoreboard"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
            <button className="modal-close" onClick={handleClose}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="modal-body" onClick={(e) => e.stopPropagation()}>
          {/* Score Inputs */}
          <div className="score-inputs">
            {gameScores.map((score, index) => (
              <div key={score.gameNumber} className="score-row">
                <div className="set-label">Set {score.gameNumber}</div>
                <div className="score-inputs-container">
                  <div className="team-input">
                    <label>{match.homeTeamName}</label>
                    <input
                      type="number"
                      min="0"
                      value={score.homeScore === 0 ? "" : score.homeScore}
                      onChange={(e) => updateGameScore(score.gameNumber, "homeScore", e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="score-input"
                      placeholder="0"
                    />
                  </div>
                  <div className="score-divider">-</div>
                  <div className="team-input">
                    <label>{match.awayTeamName}</label>
                    <input
                      type="number"
                      min="0"
                      value={score.awayScore === 0 ? "" : score.awayScore}
                      onChange={(e) => updateGameScore(score.gameNumber, "awayScore", e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="score-input"
                      placeholder="0"
                    />
                  </div>
                </div>
                {!isBestOfOne(match) && gameScores.length > 1 && (
                  <button
                    className="remove-set-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeGame(score.gameNumber);
                    }}
                    type="button"
                    title="Remove set"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add Set Button */}
          {!isBestOfOne(match) && canAddMoreSets() && (
            <div className="add-set-section">
              <button
                className="add-set-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  addGame();
                }}
                type="button"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" />
                </svg>
                Add Another Set
              </button>
            </div>
          )}

          {errors.length > 0 && (
            <div className="error-messages">
              {errors.map((error, index) => (
                <p key={index} className="error-message">
                  {error}
                </p>
              ))}
            </div>
          )}

          <div className="modal-actions">
            <button
              className="btn btn-secondary"
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={(e) => {
                e.stopPropagation();
                handleSubmit();
              }}
              disabled={loading}
            >
              {loading ? "Saving..." : "Save Scores"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateScoreDialog;
