import React, { useState, useEffect } from "react";
import { Match, MatchGameScore } from "../../matches/api/matches";
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
  const [activeTab, setActiveTab] = useState<"quick" | "detailed">("quick");
  const [showSwitchReminder, setShowSwitchReminder] = useState(false);
  const [switchSideInterval, setSwitchSideInterval] = useState(11);

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
    }
  }, [match]);

  // Check for switch side reminder
  useEffect(() => {
    if (activeTab === "quick" && gameScores.length > 0) {
      const currentGame = gameScores[gameScores.length - 1];
      const totalPoints = currentGame.homeScore + currentGame.awayScore;
      if (totalPoints > 0 && totalPoints % switchSideInterval === 0) {
        setShowSwitchReminder(true);
        const timer = setTimeout(() => setShowSwitchReminder(false), 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [gameScores, activeTab, switchSideInterval]);

  const getBestOfValue = (match: Match): number => {
    return match.bestOf || 1;
  };

  const updateGameScore = (gameNumber: number, field: "homeScore" | "awayScore", value: string) => {
    const numericValue = value === "" ? 0 : Math.max(0, parseInt(value) || 0);
    setGameScores((prev) =>
      prev.map((score) => (score.gameNumber === gameNumber ? { ...score, [field]: numericValue } : score))
    );
  };

  const quickUpdateScore = (team: "home" | "away", action: "add" | "subtract") => {
    const currentGame = gameScores[gameScores.length - 1];
    if (!currentGame) return;

    // Hide switch reminder when adding scores
    if (showSwitchReminder) {
      setShowSwitchReminder(false);
    }

    const currentScore = team === "home" ? currentGame.homeScore : currentGame.awayScore;
    const newScore = action === "add" ? currentScore + 1 : Math.max(0, currentScore - 1);

    updateGameScore(currentGame.gameNumber, `${team}Score` as "homeScore" | "awayScore", newScore.toString());
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
  };

  const removeGame = (gameNumber: number) => {
    setGameScores((prev) => prev.filter((score) => score.gameNumber !== gameNumber));
  };

  const handleClose = () => {
    setGameScores([]);
    setErrors([]);
    onClose();
  };

  if (!isOpen || !match) return null;

  const currentGame = gameScores[gameScores.length - 1] || { gameNumber: 1, homeScore: 0, awayScore: 0 };

  // Only count completed sets (sets that have been played)
  const completedSets = gameScores.filter((score) => score.homeScore > 0 || score.awayScore > 0);
  const homeWins = completedSets.filter((score) => score.homeScore > score.awayScore).length;
  const awayWins = completedSets.filter((score) => score.awayScore > score.homeScore).length;

  return (
    <div className="update-score-modal-overlay" onClick={handleClose}>
      {/* Switch Side Reminder */}
      {showSwitchReminder && (
        <div className="switch-reminder" onClick={(e) => e.stopPropagation()}>
          <div className="reminder-content">
            <span className="reminder-icon">🔄</span>
            <span>Switch Sides!</span>
          </div>
        </div>
      )}

      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-content">
            <h3>Match Score</h3>
            <p className="match-teams">
              {match.homeTeamName} vs {match.awayTeamName}
            </p>
          </div>
          <button className="modal-close" onClick={handleClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="modal-body" onClick={(e) => e.stopPropagation()}>
          {/* Quick Score Update */}
          {activeTab === "quick" && (
            <div className="quick-score-section">
              <div className="score-display">
                <div className="team-score home">
                  <div className="team-name">{match.homeTeamName}</div>
                  <div className="score-value">{currentGame.homeScore}</div>
                  <div className="score-controls">
                    <button
                      className="score-btn add"
                      onClick={(e) => {
                        e.stopPropagation();
                        quickUpdateScore("home", "add");
                      }}
                    >
                      +
                    </button>
                    <button
                      className="score-btn subtract"
                      onClick={(e) => {
                        e.stopPropagation();
                        quickUpdateScore("home", "subtract");
                      }}
                      disabled={currentGame.homeScore === 0}
                    >
                      -
                    </button>
                  </div>
                </div>

                <div className="score-divider">
                  <span>VS</span>
                </div>

                <div className="team-score away">
                  <div className="team-name">{match.awayTeamName}</div>
                  <div className="score-value">{currentGame.awayScore}</div>
                  <div className="score-controls">
                    <button
                      className="score-btn add"
                      onClick={(e) => {
                        e.stopPropagation();
                        quickUpdateScore("away", "add");
                      }}
                    >
                      +
                    </button>
                    <button
                      className="score-btn subtract"
                      onClick={(e) => {
                        e.stopPropagation();
                        quickUpdateScore("away", "subtract");
                      }}
                      disabled={currentGame.awayScore === 0}
                    >
                      -
                    </button>
                  </div>
                </div>
              </div>

              <div className="match-summary">
                <div className="summary-item">
                  <span>Home Wins {homeWins}</span>
                </div>
                <div className="summary-item">
                  <span>Away Wins {awayWins}</span>
                </div>
                <div className="summary-item">
                  <span>Current Set {currentGame.gameNumber}</span>
                </div>
              </div>
            </div>
          )}

          {/* Detailed Score Update */}
          {activeTab === "detailed" && (
            <div className="detailed-score-section">
              <div className="games-grid">
                {gameScores.map((score) => (
                  <div key={score.gameNumber} className="game-score-card">
                    <div className="game-header">
                      <h5>Set {score.gameNumber}</h5>
                      {gameScores.length > 1 && (
                        <button
                          className="remove-game-btn"
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
                    <div className="score-inputs">
                      <div className="team-score">
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
                      <div className="team-score">
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
                  </div>
                ))}
              </div>

              {gameScores.length < getBestOfValue(match) && (
                <div className="add-game-section">
                  <button
                    className="add-game-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      addGame();
                    }}
                    type="button"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" />
                    </svg>
                    Add Set
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tab Navigation */}
          <div className="tab-navigation">
            <button
              className={`tab-btn ${activeTab === "quick" ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab("quick");
              }}
            >
              Detailed
            </button>
            <button
              className={`tab-btn ${activeTab === "detailed" ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab("detailed");
              }}
            >
              Quick Update
            </button>
            {activeTab === "quick" && (
              <div className="switch-interval-config">
                <label>Switch every:</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={switchSideInterval}
                  onChange={(e) => setSwitchSideInterval(parseInt(e.target.value) || 11)}
                  className="interval-input"
                />
                <span>points</span>
              </div>
            )}
          </div>

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
              {loading ? "Updating..." : "Save Score"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateScoreDialog;
