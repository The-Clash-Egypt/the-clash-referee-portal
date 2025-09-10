import React, { useState, useMemo, useEffect } from "react";
import { Match, Referee } from "../types/match";
import "./AssignRefereeModal.scss";

interface AssignRefereeModalProps {
  isOpen: boolean;
  match: Match | null;
  onClose: () => void;
  onAssign: (refereeId: string) => Promise<void>;
  loading: boolean;
}

const AssignRefereeModal: React.FC<AssignRefereeModalProps> = ({ isOpen, match, onClose, onAssign, loading }) => {
  const [searchTerm, setSearchTerm] = useState("");

  const [filteredReferees, setFilteredReferees] = useState<Referee[]>([]);

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

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString);
    return date.toLocaleString();
  };

  if (!isOpen || !match) return null;

  return (
    <div className="assign-referee-modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Assign Referee to Match</h3>
          <button className="modal-close" onClick={onClose}>
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
              <strong>Venue:</strong> {match.venue}
            </p>
            <p>
              <strong>Time:</strong> {match.startTime ? formatDateTime(match.startTime) : "TBD"}
            </p>
          </div>

          <div className="referees-section">
            <div className="search-section">
              <h4>Search Referees</h4>
              {!searchTerm && (
                <div className="search-prompt">
                  <p>Please search for a referee to assign to this match.</p>
                </div>
              )}
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="referee-search-input"
              />
              <div className="search-info">
                {searchTerm && <span className="filtered-count">Showing: {filteredReferees.length}</span>}
                {!searchTerm && <span className="search-required">Search required</span>}
              </div>
            </div>

            <div className="referees-list">
              {filteredReferees.length === 0 ? (
                <div className="no-results">
                  {searchTerm ? <p>No referees found matching "{searchTerm}"</p> : <p>No referees available</p>}
                  {!searchTerm && <p>Please search for a referee to see available options</p>}
                </div>
              ) : (
                <div className="referees-grid">
                  {filteredReferees.map((referee) => (
                    <div key={referee.id} className="referee-item">
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
    </div>
  );
};

export default AssignRefereeModal;
