import React, { useState, useEffect } from "react";
import { Match, MatchGameScore } from "../types/match";
import { updateLiveScore } from "../api/matches";
import "./UpdateScoreDialog.scss";

interface UpdateScoreDialogProps {
  isOpen: boolean;
  match: Match | null;
  onClose: () => void;
  onSubmit: (gameScores: MatchGameScore[]) => Promise<void>;
  loading: boolean;
  venueAccessToken?: string;
  openInFullscreen?: boolean; // New prop to control fullscreen behavior
}

const UpdateScoreDialog: React.FC<UpdateScoreDialogProps> = ({
  isOpen,
  match,
  onClose,
  onSubmit,
  loading,
  venueAccessToken,
  openInFullscreen = false,
}) => {
  const [gameScores, setGameScores] = useState<MatchGameScore[]>([]);
  const [originalGameScores, setOriginalGameScores] = useState<MatchGameScore[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedSetIndex, setSelectedSetIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [hasLoggedFirstPoint, setHasLoggedFirstPoint] = useState(false);
  const [preservedGameScores, setPreservedGameScores] = useState<MatchGameScore[]>([]);
  const [preservedSelectedSetIndex, setPreservedSelectedSetIndex] = useState(0);
  const [wasInitiallyMobile, setWasInitiallyMobile] = useState(false);
  const [showRotateHint, setShowRotateHint] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [rotateHintDismissed, setRotateHintDismissed] = useState(false);
  const [sidesSwapped, setSidesSwapped] = useState(false);

  // Check if device is mobile and orientation
  useEffect(() => {
    const checkMobile = () => {
      // Check if it's a mobile/tablet device based on screen size in any orientation
      // Use the smaller dimension to determine if it's a mobile device
      const minDimension = Math.min(window.innerWidth, window.innerHeight);
      const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      const isMobileDevice =
        minDimension <= 768 || (isTouchDevice && Math.max(window.innerWidth, window.innerHeight) <= 1024);

      setIsMobile(isMobileDevice);

      // Track if it was mobile on initial load
      if (!wasInitiallyMobile && isMobileDevice) {
        setWasInitiallyMobile(true);
      }

      // Check orientation
      const isLandscapeOrientation = window.innerWidth > window.innerHeight;
      setIsLandscape(isLandscapeOrientation);

      // Hide rotate hint when in landscape
      if (isLandscapeOrientation) {
        setShowRotateHint(false);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, [wasInitiallyMobile]);

  // Auto-open fullscreen for guest venue on mobile
  useEffect(() => {
    if (isOpen && openInFullscreen && isMobile) {
      setIsFullscreen(true);
    }
  }, [isOpen, openInFullscreen, isMobile]);

  // Show rotate hint when entering fullscreen in portrait mode
  useEffect(() => {
    if (isFullscreen && !isLandscape && (isMobile || wasInitiallyMobile) && !rotateHintDismissed) {
      setShowRotateHint(true);
    } else {
      setShowRotateHint(false);
    }
  }, [isFullscreen, isLandscape, isMobile, wasInitiallyMobile, rotateHintDismissed]);

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
    if (match && isOpen) {
      let initialScores: MatchGameScore[] = [];

      // For guest venue context, check if we have preserved scores for this match
      if (openInFullscreen && preservedGameScores.length > 0) {
        initialScores = [...preservedGameScores];
        setSelectedSetIndex(preservedSelectedSetIndex);
      } else {
        // Normal initialization
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
        setSelectedSetIndex(0);
        // Reset wasInitiallyMobile when opening fresh (not preserving state)
        setWasInitiallyMobile(false);
      }

      setGameScores(initialScores);
      setOriginalGameScores([...initialScores]); // Store original scores for reset functionality
      setErrors([]);
      setIsUnauthorized(false);
      setHasLoggedFirstPoint(false);
    }
  }, [match, isOpen, openInFullscreen, preservedGameScores, preservedSelectedSetIndex]);

  // Send live score updates when game scores change (with debouncing)
  // Only send live score updates after the first point has been logged
  useEffect(() => {
    // Don't send live score updates if user is unauthorized
    if (isUnauthorized) return;

    // Check if any point has been logged
    const hasAnyPoints = gameScores.some((score) => score.homeScore > 0 || score.awayScore > 0);

    if (hasAnyPoints && !hasLoggedFirstPoint) {
      setHasLoggedFirstPoint(true);
    }

    // Only send live score updates after first point is logged
    if (hasLoggedFirstPoint) {
      const timeoutId = setTimeout(() => {
        sendLiveScore(gameScores);
      }, 500); // 500ms debounce

      return () => clearTimeout(timeoutId);
    }
  }, [gameScores, isUnauthorized, hasLoggedFirstPoint]);

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

  // Function to send live score updates
  const sendLiveScore = async (gameScores: MatchGameScore[]) => {
    if (!match?.id) return;

    try {
      await updateLiveScore(
        {
          matchId: match.id,
          gameScores: gameScores,
        },
        venueAccessToken
      );
    } catch (error: any) {
      console.error("Failed to update live score:", error);

      // Check if it's a 401 unauthorized error
      if (error.response?.status === 401) {
        setIsUnauthorized(true);
        setErrors(["Your venue access token is invalid or expired. Please contact the tournament organizer."]);
        // Reset scores to original values
        setGameScores([...originalGameScores]);
      } else {
        // Handle other errors
        setErrors(["Failed to update live score. Please try again."]);
      }
    }
  };

  const updateGameScore = (gameNumber: number, field: "homeScore" | "awayScore", value: string) => {
    const numericValue = value === "" ? 0 : Math.max(0, parseInt(value) || 0);
    setGameScores((prev) => {
      const updatedScores = prev.map((score) =>
        score.gameNumber === gameNumber ? { ...score, [field]: numericValue } : score
      );

      return updatedScores;
    });
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
    setGameScores((prev) => {
      const newScores = [
        ...prev,
        {
          gameNumber: nextGameNumber,
          homeScore: 0,
          awayScore: 0,
        },
      ];

      return newScores;
    });

    // In fullscreen mode, automatically select the newly added game
    if (isFullscreen) {
      setSelectedSetIndex(nextGameNumber - 1);
    }
  };

  const removeGame = (gameNumber: number) => {
    setGameScores((prev) => {
      const newScores = prev.filter((score) => score.gameNumber !== gameNumber);

      return newScores;
    });
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
    setOriginalGameScores([]);
    setErrors([]);
    setIsUnauthorized(false);
    setIsFullscreen(false);
    setSelectedSetIndex(0);
    setHasLoggedFirstPoint(false);
    setPreservedGameScores([]);
    setPreservedSelectedSetIndex(0);
    setWasInitiallyMobile(false);
    setRotateHintDismissed(false);
    setSidesSwapped(false);
    onClose();
  };

  const handleGuestVenueClose = () => {
    // For guest venue context, preserve the current state but close the dialog
    setPreservedGameScores([...gameScores]);
    setPreservedSelectedSetIndex(selectedSetIndex);
    setErrors([]);
    setIsUnauthorized(false);
    setIsFullscreen(false);
    setWasInitiallyMobile(false);
    setRotateHintDismissed(false);
    setSidesSwapped(false);
    onClose();
  };

  const exitFullscreen = () => {
    if (openInFullscreen) {
      // If opened in fullscreen mode (guest venue context), close the dialog but preserve state
      handleGuestVenueClose();
    } else {
      // Otherwise, just exit fullscreen mode
      setIsFullscreen(false);
      setWasInitiallyMobile(false);
      setRotateHintDismissed(false);
    }
  };

  if (!isOpen || !match) return null;

  // Only count completed sets (sets that have been played)
  const completedSets = gameScores.filter((score) => score.homeScore > 0 || score.awayScore > 0);
  const homeWins = completedSets.filter((score) => score.homeScore > score.awayScore).length;
  const awayWins = completedSets.filter((score) => score.awayScore > score.homeScore).length;
  const currentGame = gameScores[selectedSetIndex] || { gameNumber: 1, homeScore: 0, awayScore: 0 };

  // Fullscreen Scoreboard View (Mobile Only)
  // Keep fullscreen open if it was opened on a mobile device, even after rotation
  if (isFullscreen && (isMobile || wasInitiallyMobile) && !isUnauthorized) {
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

            {/* Switch Sides Button */}
            <button className="switch-sides-btn" onClick={() => setSidesSwapped(!sidesSwapped)} title="Switch sides">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M7 16L3 12L7 8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M3 12H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path
                  d="M17 8L21 12L17 16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Rotate Hint */}
          {showRotateHint && !isLandscape && (
            <div className="rotate-hint">
              <svg className="rotate-icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M7.5 6.5C7.5 3.46 9.96 1 13 1s5.5 2.46 5.5 5.5-2.46 5.5-5.5 5.5H3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M6 9L3 12L6 15"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Rotate device for better view</span>
              <button
                className="dismiss-hint-btn"
                onClick={() => setRotateHintDismissed(true)}
                aria-label="Dismiss hint"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )}

          {/* Scoreboard */}
          <div className="scoreboard-main">
            <div className="team-section home">
              <div className="team-name">{sidesSwapped ? match.awayTeamName : match.homeTeamName}</div>
              <div className="score-display">{sidesSwapped ? currentGame.awayScore : currentGame.homeScore}</div>
              <div className="score-controls">
                <button
                  className="score-btn add"
                  onClick={() => quickUpdateScore(sidesSwapped ? "away" : "home", "add")}
                >
                  +
                </button>
                <button
                  className="score-btn subtract"
                  onClick={() => quickUpdateScore(sidesSwapped ? "away" : "home", "subtract")}
                  disabled={sidesSwapped ? currentGame.awayScore === 0 : currentGame.homeScore === 0}
                >
                  -
                </button>
              </div>
            </div>

            <div className="team-section away">
              <div className="team-name">{sidesSwapped ? match.homeTeamName : match.awayTeamName}</div>
              <div className="score-display">{sidesSwapped ? currentGame.homeScore : currentGame.awayScore}</div>
              <div className="score-controls">
                <button
                  className="score-btn add"
                  onClick={() => quickUpdateScore(sidesSwapped ? "home" : "away", "add")}
                >
                  +
                </button>
                <button
                  className="score-btn subtract"
                  onClick={() => quickUpdateScore(sidesSwapped ? "home" : "away", "subtract")}
                  disabled={sidesSwapped ? currentGame.homeScore === 0 : currentGame.awayScore === 0}
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
                <span className="label">{sidesSwapped ? "Away Wins" : "Home Wins"}</span>
                <span className="value">{sidesSwapped ? awayWins : homeWins}</span>
              </div>
              <div className="progress-item">
                <span className="label">Sets</span>
                <span className="value">
                  {completedSets.length}/{getBestOfValue(match)}
                </span>
              </div>
              <div className="progress-item">
                <span className="label">{sidesSwapped ? "Home Wins" : "Away Wins"}</span>
                <span className="value">{sidesSwapped ? homeWins : awayWins}</span>
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
                disabled={isUnauthorized}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="2" width="20" height="20" rx="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="bold" fill="currentColor">
                    1:0
                  </text>
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
                      disabled={isUnauthorized}
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
                      disabled={isUnauthorized}
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
                    disabled={isUnauthorized}
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
                disabled={isUnauthorized}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" />
                </svg>
                Add Another Set
              </button>
            </div>
          )}

          {errors.length > 0 && (
            <div className={`error-messages ${isUnauthorized ? "unauthorized-error" : ""}`}>
              {errors.map((error, index) => (
                <p key={index} className={`error-message ${isUnauthorized ? "unauthorized-message" : ""}`}>
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
              disabled={loading || isUnauthorized}
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
