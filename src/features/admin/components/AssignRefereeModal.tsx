import React from "react";
import { Match, Referee } from "../../matches/api/matches";
import "./AssignRefereeModal.scss";

interface AssignRefereeModalProps {
  isOpen: boolean;
  match: Match | null;
  referees: Referee[];
  onClose: () => void;
  onAssign: (refereeId: string) => Promise<void>;
  loading: boolean;
}

const AssignRefereeModal: React.FC<AssignRefereeModalProps> = ({
  isOpen,
  match,
  referees,
  onClose,
  onAssign,
  loading,
}) => {
  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString);
    return date.toLocaleString();
  };

  if (!isOpen || !match) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Assign Referee to Match</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="match-info">
            <h4>Match Details:</h4>
            <p>
              <strong>Teams:</strong> {match.homeTeamName} vs {match.awayTeamName}
            </p>
            <p>
              <strong>Venue:</strong> {match.venue}
            </p>
            <p>
              <strong>Time:</strong> {match.startTime ? formatDateTime(match.startTime) : "TBD"}
            </p>
          </div>

          <div className="referees-list">
            <h4>Available Referees:</h4>
            {referees.length === 0 ? (
              <p>No referees available</p>
            ) : (
              <div className="referees-grid">
                {referees.map((referee) => (
                  <div key={referee.id} className="referee-card">
                    <div className="referee-info">
                      <h5>{referee.fullName}</h5>
                      <p>{referee.email}</p>
                    </div>
                    <button className="assign-button" onClick={() => onAssign(referee.id)} disabled={loading}>
                      {loading ? "Assigning..." : "Assign"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignRefereeModal;
