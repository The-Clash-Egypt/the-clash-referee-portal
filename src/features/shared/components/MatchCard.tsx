import React from "react";
import { Match } from "../../matches/api/matches";
import "./MatchCard.scss";

interface MatchCardProps {
  match: Match;
  onAssignReferee?: (match: Match) => void;
  onUnassignReferee?: (refereeId: string, matchId: string) => Promise<void>;
  onUpdateScore?: (match: Match) => void;
  showAdminActions?: boolean;
  showUpdateScore?: boolean;
  showAssignReferee?: boolean;
}

const MatchCard: React.FC<MatchCardProps> = ({
  match,
  onAssignReferee,
  onUnassignReferee,
  onUpdateScore,
  showAdminActions = false,
  showUpdateScore = true,
  showAssignReferee = true,
}) => {
  const handleUpdateScore = () => {
    if (onUpdateScore) {
      onUpdateScore(match);
    }
  };

  const handleUnassignReferee = async (refereeId: string) => {
    if (onUnassignReferee) {
      await onUnassignReferee(refereeId, match.id);
    }
  };

  return (
    <div className="match-card">
      {/* Tournament Info Header */}
      <div className="tournament-header">
        {match.tournamentName && <div className="tournament-name">{match.tournamentName}</div>}
        <div className="tournament-meta">
          {match.categoryName && <span className="category-badge">{match.categoryName}</span>}
          {match.format && <span className="format-badge">{match.format}</span>}
        </div>
      </div>

      {/* Match Header */}
      <div className="match-header">
        <div className="match-info">
          <div className="round-section">
            <span className="round-badge">{match.round}</span>
            <div className="match-time-venue">
              <span className="match-time">{match.startTime ? new Date(match.startTime).toLocaleString() : "TBD"}</span>
              {match.venue && <span className="match-time-divider">•</span>}
              {match.venue && <span className="match-venue">{match.venue}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Teams Section */}
      <div className="teams-section">
        <div className="team home-team">
          <div className="team-info">
            <span className="team-name">{match.homeTeamName || "TBD"}</span>
            <div className="team-game-scores">
              {match.gameScores?.map((game, id) => (
                <span key={id} className={`team-game-score ${game.homeScore > game.awayScore ? "winner" : ""}`}>
                  {game.homeScore}
                </span>
              ))}
            </div>
            {match.isCompleted && <span className="team-score">{match.homeScore || "0"}</span>}
          </div>
        </div>

        <div className="match-center">
          {!match.isCompleted ? <div className="vs-badge">VS</div> : <div className="score-divider">-</div>}
        </div>

        <div className="team away-team">
          <div className="team-info">
            <span className="team-name">{match.awayTeamName || "TBD"}</span>
            <div className="team-game-scores">
              {match.gameScores?.map((game, id) => (
                <span key={id} className={`team-game-score ${game.awayScore > game.homeScore ? "winner" : ""}`}>
                  {game.awayScore}
                </span>
              ))}
            </div>
            {match.isCompleted && <span className="team-score">{match.awayScore || "0"}</span>}
          </div>
        </div>
      </div>

      {/* Assigned Referees */}
      {match.referees && match.referees.length > 0 && showAssignReferee && (
        <div className="referees-section">
          <div className="section-title">Assigned Referees</div>
          <div className="referees-list">
            {match.referees.map((referee, index) => (
              <div key={referee.id} className="referee-item">
                <div className="referee-info">
                  <span className="referee-name">{referee.fullName}</span>
                  <span className="referee-email">{referee.email}</span>
                </div>
                {showAdminActions && onUnassignReferee && (
                  <button
                    className="unassign-button"
                    onClick={() => handleUnassignReferee(referee.id)}
                    title="Unassign referee"
                  >
                    -
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="match-actions">
        {showAdminActions && onAssignReferee && (
          <button className="btn btn-primary" onClick={() => onAssignReferee(match)}>
            Assign Referee
          </button>
        )}
        {onUpdateScore && showUpdateScore && (
          <button className="btn btn-secondary" onClick={handleUpdateScore}>
            Update Score
          </button>
        )}
      </div>
    </div>
  );
};

export default MatchCard;
