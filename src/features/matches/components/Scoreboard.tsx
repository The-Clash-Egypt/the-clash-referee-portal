import React, { useState, useEffect } from "react";
import { Match, MatchGameScore } from "../api/matches";
import "./Scoreboard.scss";

interface ScoreboardProps {
  match: Match;
  onScoreUpdate?: (gameScores: MatchGameScore[]) => void;
  switchSideInterval?: number; // Points interval to remind switching sides
}

interface CurrentSet {
  gameNumber: number;
  homeScore: number;
  awayScore: number;
  isCompleted: boolean;
}

const Scoreboard: React.FC<ScoreboardProps> = ({ match, onScoreUpdate, switchSideInterval = 11 }) => {
  const [currentSet, setCurrentSet] = useState<CurrentSet>({
    gameNumber: 1,
    homeScore: 0,
    awayScore: 0,
    isCompleted: false,
  });
  const [completedSets, setCompletedSets] = useState<MatchGameScore[]>([]);
  const [showSwitchReminder, setShowSwitchReminder] = useState(false);

  // Initialize with existing game scores
  useEffect(() => {
    if (match.gameScores && match.gameScores.length > 0) {
      const existingSets = match.gameScores.filter((score) => score.homeScore > 0 || score.awayScore > 0);
      setCompletedSets(existingSets);

      // Set current set to next game number
      const nextGameNumber = existingSets.length + 1;
      setCurrentSet({
        gameNumber: nextGameNumber,
        homeScore: 0,
        awayScore: 0,
        isCompleted: false,
      });
    }
  }, [match]);

  // Check for switch side reminder
  useEffect(() => {
    const totalPoints = currentSet.homeScore + currentSet.awayScore;
    if (totalPoints > 0 && totalPoints % switchSideInterval === 0) {
      setShowSwitchReminder(true);
      const timer = setTimeout(() => setShowSwitchReminder(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [currentSet.homeScore, currentSet.awayScore, switchSideInterval]);

  const updateScore = (team: "home" | "away", action: "add" | "subtract") => {
    // Hide switch reminder when adding scores
    if (showSwitchReminder) {
      setShowSwitchReminder(false);
    }

    setCurrentSet((prev) => {
      const currentScore = team === "home" ? prev.homeScore : prev.awayScore;
      const newScore = action === "add" ? currentScore + 1 : Math.max(0, currentScore - 1);

      return {
        ...prev,
        [`${team}Score`]: newScore,
      };
    });
  };

  const completeSet = () => {
    if (currentSet.homeScore === currentSet.awayScore) {
      alert("A set cannot end in a tie. Please continue playing.");
      return;
    }

    const completedSet: MatchGameScore = {
      gameNumber: currentSet.gameNumber,
      homeScore: currentSet.homeScore,
      awayScore: currentSet.awayScore,
    };

    const newCompletedSets = [...completedSets, completedSet];
    setCompletedSets(newCompletedSets);

    // Start new set
    setCurrentSet({
      gameNumber: currentSet.gameNumber + 1,
      homeScore: 0,
      awayScore: 0,
      isCompleted: false,
    });

    // Notify parent component
    if (onScoreUpdate) {
      onScoreUpdate(newCompletedSets);
    }
  };

  const undoLastSet = () => {
    if (completedSets.length > 0) {
      const newCompletedSets = completedSets.slice(0, -1);
      setCompletedSets(newCompletedSets);

      // Reset current set to the last completed set number
      const lastSetNumber =
        newCompletedSets.length > 0 ? newCompletedSets[newCompletedSets.length - 1].gameNumber + 1 : 1;

      setCurrentSet({
        gameNumber: lastSetNumber,
        homeScore: 0,
        awayScore: 0,
        isCompleted: false,
      });

      if (onScoreUpdate) {
        onScoreUpdate(newCompletedSets);
      }
    }
  };

  const getMatchStatus = () => {
    // Only count completed sets (sets that have been played)
    const playedSets = completedSets.filter((set) => set.homeScore > 0 || set.awayScore > 0);
    const homeWins = playedSets.filter((set) => set.homeScore > set.awayScore).length;
    const awayWins = playedSets.filter((set) => set.awayScore > set.homeScore).length;
    const bestOf = match.bestOf || 1;
    const neededToWin = Math.ceil(bestOf / 2);

    if (homeWins >= neededToWin) return `${match.homeTeamName} Wins!`;
    if (awayWins >= neededToWin) return `${match.awayTeamName} Wins!`;
    return `Best of ${bestOf} - Set ${currentSet.gameNumber}`;
  };

  return (
    <div className="scoreboard">
      {/* Switch Side Reminder */}
      {showSwitchReminder && (
        <div className="switch-reminder">
          <div className="reminder-content">
            <span className="reminder-icon">🔄</span>
            <span>Switch Sides!</span>
          </div>
        </div>
      )}

      {/* Match Header */}
      <div className="match-header">
        <h2 className="match-title">
          {match.homeTeamName} vs {match.awayTeamName}
        </h2>
        <p className="match-status">{getMatchStatus()}</p>
      </div>

      {/* Current Set Score */}
      <div className="current-set">
        <h3 className="set-title">Set {currentSet.gameNumber}</h3>
        <div className="score-display">
          <div className="team-score home">
            <div className="team-name">{match.homeTeamName}</div>
            <div className="score-value">{currentSet.homeScore}</div>
            <div className="score-controls">
              <button
                className="score-btn add"
                onClick={(e) => {
                  e.stopPropagation();
                  updateScore("home", "add");
                }}
                disabled={currentSet.isCompleted}
              >
                +
              </button>
              <button
                className="score-btn subtract"
                onClick={(e) => {
                  e.stopPropagation();
                  updateScore("home", "subtract");
                }}
                disabled={currentSet.homeScore === 0 || currentSet.isCompleted}
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
            <div className="score-value">{currentSet.awayScore}</div>
            <div className="score-controls">
              <button
                className="score-btn add"
                onClick={(e) => {
                  e.stopPropagation();
                  updateScore("away", "add");
                }}
                disabled={currentSet.isCompleted}
              >
                +
              </button>
              <button
                className="score-btn subtract"
                onClick={(e) => {
                  e.stopPropagation();
                  updateScore("away", "subtract");
                }}
                disabled={currentSet.awayScore === 0 || currentSet.isCompleted}
              >
                -
              </button>
            </div>
          </div>
        </div>

        <div className="set-actions">
          <button
            className="complete-set-btn"
            onClick={(e) => {
              e.stopPropagation();
              completeSet();
            }}
            disabled={currentSet.homeScore === 0 && currentSet.awayScore === 0}
          >
            Complete Set
          </button>
        </div>
      </div>

      {/* Completed Sets */}
      {completedSets.length > 0 && (
        <div className="completed-sets">
          <h3 className="sets-title">Completed Sets</h3>
          <div className="sets-grid">
            {completedSets.map((set, index) => (
              <div key={set.gameNumber} className="set-card">
                <div className="set-number">Set {set.gameNumber}</div>
                <div className="set-score">
                  <span className="home-score">{set.homeScore}</span>
                  <span className="score-separator">-</span>
                  <span className="away-score">{set.awayScore}</span>
                </div>
                <div className="set-winner">
                  {set.homeScore > set.awayScore ? match.homeTeamName : match.awayTeamName}
                </div>
              </div>
            ))}
          </div>
          <button
            className="undo-btn"
            onClick={(e) => {
              e.stopPropagation();
              undoLastSet();
            }}
          >
            Undo Last Set
          </button>
        </div>
      )}

      {/* Match Summary */}
      <div className="match-summary">
        <div className="summary-item">
          <span className="summary-label">Home Wins:</span>
          <span className="summary-value">
            {
              completedSets
                .filter((set) => set.homeScore > 0 || set.awayScore > 0)
                .filter((set) => set.homeScore > set.awayScore).length
            }
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Away Wins:</span>
          <span className="summary-value">
            {
              completedSets
                .filter((set) => set.homeScore > 0 || set.awayScore > 0)
                .filter((set) => set.awayScore > set.homeScore).length
            }
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Total Sets:</span>
          <span className="summary-value">{completedSets.length}</span>
        </div>
      </div>
    </div>
  );
};

export default Scoreboard;
