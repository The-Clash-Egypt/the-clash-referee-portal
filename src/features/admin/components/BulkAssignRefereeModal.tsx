import React, { useState, useMemo, useEffect } from "react";
import { Match, Referee } from "../../matches/api/matches";
import "./BulkAssignRefereeModal.scss";

interface BulkAssignRefereeModalProps {
  isOpen: boolean;
  selectedMatches: Match[];
  referees: Referee[];
  onClose: () => void;
  onAssign: (refereeId: string, matchIds: string[]) => Promise<void>;
  loading: boolean;
}

const BulkAssignRefereeModal: React.FC<BulkAssignRefereeModalProps> = ({
  isOpen,
  selectedMatches,
  referees,
  onClose,
  onAssign,
  loading,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReferee, setSelectedReferee] = useState<Referee | null>(null);

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

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString);
    return date.toLocaleString();
  };

  const filteredReferees = useMemo(() => {
    if (!searchTerm.trim()) {
      return referees;
    }

    return referees.filter(
      (referee) =>
        referee.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        referee.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [referees, searchTerm]);

  const handleAssign = async () => {
    if (!selectedReferee) return;

    const matchIds = selectedMatches.map((match) => match.id);
    await onAssign(selectedReferee.id, matchIds);
    setSelectedReferee(null);
  };

  const getUniqueVenues = () => {
    const venues = selectedMatches.map((match) => match.venue).filter(Boolean);
    return Array.from(new Set(venues));
  };

  const getUniqueTournaments = () => {
    const tournaments = selectedMatches.map((match) => match.tournamentName).filter(Boolean);
    return Array.from(new Set(tournaments));
  };

  if (!isOpen) return null;

  return (
    <div className="bulk-assign-referee-modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Bulk Assign Referee</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="selected-matches-info">
            <h4>Selected Matches ({selectedMatches.length})</h4>
            <div className="matches-summary">
              <div className="summary-item">
                <strong>Tournaments:</strong> {getUniqueTournaments().join(", ")}
              </div>
              <div className="summary-item">
                <strong>Venues:</strong> {getUniqueVenues().join(", ")}
              </div>
            </div>

            <div className="matches-list">
              {selectedMatches.slice(0, 5).map((match) => (
                <div key={match.id} className="match-item">
                  <span className="teams">
                    {match.homeTeamName} vs {match.awayTeamName}
                  </span>
                  <span className="venue">{match.venue}</span>
                  <span className="time">{match.startTime ? formatDateTime(match.startTime) : "TBD"}</span>
                </div>
              ))}
              {selectedMatches.length > 5 && (
                <div className="more-matches">... and {selectedMatches.length - 5} more matches</div>
              )}
            </div>
          </div>

          <div className="referees-section">
            <div className="search-section">
              <h4>Select Referee</h4>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="referee-search-input"
              />
              <div className="search-info">
                {searchTerm && <span className="filtered-count">Showing: {filteredReferees.length}</span>}
              </div>
            </div>

            <div className="referees-list">
              {filteredReferees.length === 0 ? (
                <div className="no-results">
                  <p>No referees found matching "{searchTerm}"</p>
                </div>
              ) : (
                <div className="referees-grid">
                  {filteredReferees.map((referee, id) =>
                    id < 3 ? (
                      <div
                        key={referee.id}
                        className={`referee-item ${selectedReferee?.id === referee.id ? "selected" : ""}`}
                        onClick={() => setSelectedReferee(referee)}
                      >
                        <div className="referee-info">
                          <h5>{referee.fullName}</h5>
                          <p>{referee.email}</p>
                        </div>
                        <div className="selection-indicator">
                          {selectedReferee?.id === referee.id && <span className="checkmark">✓</span>}
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="modal-actions">
            <button className="assign-button" onClick={handleAssign} disabled={loading || !selectedReferee}>
              {loading
                ? "Assigning..."
                : `Assign to ${selectedMatches.length} Match${selectedMatches.length !== 1 ? "es" : ""}`}
            </button>
            <button className="cancel-button" onClick={onClose} disabled={loading}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkAssignRefereeModal;
