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

  // Initialize game scores when match changes
  useEffect(() => {
    if (match) {
      const bestOf = getBestOfValue(match);
      const initialScores: MatchGameScore[] = [];

      // Start with existing game scores
      if (match.gameScores && match.gameScores.length > 0) {
        initialScores.push(...match.gameScores);
      }

      // If no existing scores, start with one empty game
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

  const getBestOfValue = (match: Match): number => {
    if (match.bestOf) {
      return match.bestOf;
    }
    return 1;
  };

  const updateGameScore = (gameNumber: number, field: "homeScore" | "awayScore", value: number) => {
    setGameScores((prev) =>
      prev.map((score) =>
        score.gameNumber === gameNumber
          ? { ...score, [field]: Math.max(0, value) } // Ensure non-negative values
          : score
      )
    );
  };

  const validateScores = (): boolean => {
    const newErrors: string[] = [];

    // Check if at least one game has been played
    const hasPlayedGames = gameScores.some((score) => score.homeScore > 0 || score.awayScore > 0);
    if (!hasPlayedGames) {
      newErrors.push("At least one game must have scores entered.");
    }

    // Check for valid game outcomes (no ties in most sports)
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

    // Only include games that have been played
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

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString);
    return date.toLocaleString();
  };

  return (
    <div className="update-score-modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Update Match Score</h3>
          <button className="modal-close" onClick={handleClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="match-info">
            <h4>Match Details</h4>
            <p>
              <strong>Teams:</strong> {match.homeTeamName} vs {match.awayTeamName}
            </p>
            <p>
              <strong>Format:</strong> {match.format || "Best of 1"}
            </p>
            <p>
              <strong>Venue:</strong> {match.venue || "TBD"}
            </p>
            <p>
              <strong>Time:</strong> {match.startTime ? formatDateTime(match.startTime) : "TBD"}
            </p>
          </div>

          <div className="score-section">
            <h4>Game Scores</h4>
            <p className="score-instructions">Enter scores for each game. Only games with scores will be recorded.</p>

            <div className="games-grid">
              {gameScores.map((score, index) => (
                <div key={score.gameNumber} className="game-score-card">
                  <div className="game-header">
                    <h5>Game {score.gameNumber}</h5>
                    {gameScores.length > 1 && (
                      <button
                        className="remove-game-btn"
                        onClick={() => removeGame(score.gameNumber)}
                        type="button"
                        title="Remove game"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="score-inputs">
                    <div className="team-score">
                      <label>{match.homeTeamName}</label>
                      <input
                        type="number"
                        min="0"
                        value={score.homeScore}
                        onChange={(e) => updateGameScore(score.gameNumber, "homeScore", parseInt(e.target.value) || 0)}
                        className="score-input"
                        placeholder="0"
                      />
                    </div>
                    <div className="score-divider">vs</div>
                    <div className="team-score">
                      <label>{match.awayTeamName}</label>
                      <input
                        type="number"
                        min="0"
                        value={score.awayScore}
                        onChange={(e) => updateGameScore(score.gameNumber, "awayScore", parseInt(e.target.value) || 0)}
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
                <button className="add-game-btn" onClick={addGame} type="button">
                  + Add Game
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
          </div>

          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={handleClose} disabled={loading}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? "Updating..." : "Update Score"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateScoreDialog;
