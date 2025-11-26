import React from "react";
import { Match } from "../../matches/types/match";
import "./MatchCard.scss";
import moment from "moment";
import { getMatchDuration } from "../../../utils/durationUtils";

interface MatchCardProps {
  match: Match;
  onAssignReferee?: (match: Match) => void;
  onUnassignReferee?: (refereeId: string, matchId: string) => Promise<void>;
  onUpdateScore?: (match: Match) => void;
  onEditMatch?: (match: Match) => void;
  onShareRefereeWhatsApp?: (referee: any) => void;
  showAdminActions?: boolean;
  showUpdateScore?: boolean;
  showAssignReferee?: boolean;
  isSelectable?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (matchId: string, selected: boolean) => void;
  showDuration?: boolean;
}

const MatchCard: React.FC<MatchCardProps> = ({
  match,
  onAssignReferee,
  onUnassignReferee,
  onUpdateScore,
  onEditMatch,
  onShareRefereeWhatsApp,
  showAdminActions = false,
  showUpdateScore = true,
  showAssignReferee = true,
  isSelectable = false,
  isSelected = false,
  onSelectionChange,
  showDuration = false,
}) => {
  // Determine the winner for completed matches
  const getMatchWinner = () => {
    if (!match.isCompleted || match.homeScore === undefined || match.awayScore === undefined) {
      return null;
    }
    if (match.homeScore > match.awayScore) {
      return "home";
    } else if (match.awayScore > match.homeScore) {
      return "away";
    }
    return "tie";
  };

  const matchWinner = getMatchWinner();
  const matchDuration = getMatchDuration(match);

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

  const handleSelectionChange = () => {
    if (onSelectionChange) {
      onSelectionChange(match.id, !isSelected);
    }
  };

  const generateIndividualWhatsAppMessage = (referee: any) => {
    const refereeName = referee.fullName || `${referee.firstName || ""} ${referee.lastName || ""}`.trim();
    const appUrl = window.location.origin;
    const matchTime = match.startTime ? moment(match.startTime).format("MMMM Do YYYY, h:mm a") : "TBD";
    const venue = match.venue || "TBD";
    const teams = `${match.homeTeamName || "TBD"} vs ${match.awayTeamName || "TBD"}`;
    const tournamentName = match.tournamentName || "Tournament";
    const categoryName = match.categoryName || "";
    const round = match.round || "";

    const message = `🏐 *Match Assignment*

*Tournament:* ${tournamentName}${categoryName ? ` (${categoryName})` : ""}
*Referee:* ${refereeName}

*Match Details:*
• Teams: ${teams}
• Venue: ${venue}
• Time: ${matchTime}${round ? `\n• Round: ${round}` : ""}

*Please confirm availability.*
*Portal:* ${appUrl}`;

    return message;
  };

  const shareIndividualMatchOnWhatsApp = (referee: any) => {
    if (!referee.phoneNumber) {
      alert("Phone number not available for this referee");
      return;
    }

    const message = generateIndividualWhatsAppMessage(referee);
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${referee.phoneNumber}?text=${encodedMessage}`;

    window.open(whatsappUrl, "_blank");
  };

  return (
    <div className={`match-card ${isSelectable ? "selectable" : ""} ${isSelected ? "selected" : ""}`}>
      {/* Selection Checkbox */}
      {isSelectable && (
        <div className="selection-checkbox">
          <input type="checkbox" checked={isSelected} onChange={handleSelectionChange} className="match-checkbox" />
        </div>
      )}
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
              <span className="match-time">
                {match.startTime ? moment(match.startTime).format("DD/MM/YYYY hh:mm A") : "TBD"}
              </span>
              {match.venue && <span className="match-time-divider">•</span>}
              {match.venue && <span className="match-venue">{match.venue}</span>}
              {match.bestOf && <span className="match-time-divider">•</span>}
              {match.bestOf && <span className="match-best-of">Best of {match.bestOf}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Match Times & Duration - Admin Only */}
      {showDuration && match?.startedAt && match?.endedAt && (
        <div className="match-duration">
          {match.startedAt && (
            <div className="duration-info">
              <span className="duration-label">Started:</span>
              <span className="duration-value">{moment(match.startedAt).format("hh:mm A")}</span>
            </div>
          )}
          {match.endedAt && (
            <div className="duration-info">
              <span className="duration-label">Ended:</span>
              <span className="duration-value">{moment(match.endedAt).format("hh:mm A")}</span>
            </div>
          )}
          {matchDuration && (
            <div className="duration-info">
              <span className="duration-label">Duration:</span>
              <span className="duration-value">{matchDuration}</span>
            </div>
          )}
        </div>
      )}

      {/* Teams Section */}
      <div className="teams-section">
        <div className={`team home-team ${matchWinner === "home" ? "winner" : ""}`}>
          <div className="team-info">
            <div className="team-name-container">
              <span className="team-name">{match.homeTeamName || "TBD"}</span>
              {/* Home Team Members */}
              {match.homeTeamMembers && match.homeTeamMembers.length > 0 && (
                <div className="team-members-compact">
                  <div className="members-list-compact">
                    {match.homeTeamMembers.slice(0, 3).map((member, index) => (
                      <span key={member.id} className="member-compact">
                        {member.firstName} {member.lastName}
                        {member.isCaptain && <span>(C)</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="team-game-scores">
              {match.gameScores
                ?.sort((a, b) => a.gameNumber - b.gameNumber)
                .map((game, id) => (
                  <span key={id} className={`team-game-score ${game.homeScore > game.awayScore ? "winner" : ""}`}>
                    {game.homeScore}
                  </span>
                ))}
            </div>
            {match.isCompleted && <span className="team-score">{match.homeScore || "0"}</span>}
          </div>
        </div>

        <div className={`team away-team ${matchWinner === "away" ? "winner" : ""}`}>
          <div className="team-info">
            <div className="team-name-container">
              <span className="team-name">{match.awayTeamName || "TBD"}</span>
              {/* Away Team Members */}
              {match.awayTeamMembers && match.awayTeamMembers.length > 0 && (
                <div className="team-members-compact">
                  <div className="members-list-compact">
                    {match.awayTeamMembers.slice(0, 3).map((member, index) => (
                      <span key={member.id} className="member-compact">
                        {member.firstName} {member.lastName}
                        {member.isCaptain && <span>(C)</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="team-game-scores">
              {match.gameScores
                ?.sort((a, b) => a.gameNumber - b.gameNumber)
                .map((game, id) => (
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
      {showAssignReferee && (
        <div className="referees-section">
          <div className="section-title">Assigned Referees</div>
          <div className="referees-list">
            {match?.referees && match.referees.length > 0 ? (
              match.referees?.map((referee, index) => (
                <div key={referee.id} className="referee-item">
                  <div className="referee-info">
                    <span className="referee-name">{referee.fullName}</span>
                    <span className="referee-email">{referee.email}</span>
                  </div>
                  <div className="referee-actions">
                    {showAdminActions && referee.phoneNumber && (
                      <button
                        className="whatsapp-button"
                        onClick={() => shareIndividualMatchOnWhatsApp(referee)}
                        title="Share this match on WhatsApp"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
                        </svg>
                      </button>
                    )}
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
                </div>
              ))
            ) : (
              <div className="referee-item">
                <div className="referee-info">
                  <span className="no-referee">No referees assigned for this match</span>
                </div>
              </div>
            )}
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
        {showAdminActions && onEditMatch && (
          <button className="btn btn-secondary" onClick={() => onEditMatch(match)}>
            Edit Match
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
