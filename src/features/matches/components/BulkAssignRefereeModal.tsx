import React, { useState, useEffect } from "react";
import { Match, PlayerSuggestion } from "../types/match";
import { usePlayerSuggestions, useDebounce } from "../hooks";
import "./BulkAssignRefereeModal.scss";

interface BulkAssignRefereeModalProps {
  isOpen: boolean;
  selectedMatches: Match[];
  onClose: () => void;
  onAssign: (refereeIds: string[], matchIds: string[]) => Promise<void>;
  loading: boolean;
}

const BulkAssignRefereeModal: React.FC<BulkAssignRefereeModalProps> = ({
  isOpen,
  selectedMatches,
  onClose,
  onAssign,
  loading,
}) => {
  const [searchInputs, setSearchInputs] = useState<{ id: string; value: string }[]>([{ id: "1", value: "" }]);
  const [selectedRefereesData, setSelectedRefereesData] = useState<PlayerSuggestion[]>([]);
  const [activeInputId, setActiveInputId] = useState<string>("1");

  // Get the current search term from the active input
  const currentSearchTerm = searchInputs.find((input) => input.id === activeInputId)?.value || "";
  const debouncedSearchTerm = useDebounce(currentSearchTerm, 300);

  const { data: playerSuggestions = [], isLoading: suggestionsLoading } = usePlayerSuggestions(debouncedSearchTerm);

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

  const handleInputChange = (inputId: string, value: string) => {
    setSearchInputs((prev) => prev.map((input) => (input.id === inputId ? { ...input, value } : input)));
    setActiveInputId(inputId);
  };

  const handleRefereeSelect = (referee: PlayerSuggestion) => {
    // Add referee to selected list
    setSelectedRefereesData((prev) => [...prev, referee]);

    // Clear the current input
    setSearchInputs((prev) => prev.map((input) => (input.id === activeInputId ? { ...input, value: "" } : input)));
  };

  const handleRefereeRemove = (userId: string) => {
    setSelectedRefereesData((prev) => prev.filter((ref) => ref.userId !== userId));
  };

  const handleAddRefereeInput = () => {
    const newId = Date.now().toString();
    setSearchInputs((prev) => [...prev, { id: newId, value: "" }]);
    setActiveInputId(newId);
  };

  const handleRemoveInput = (inputId: string) => {
    if (searchInputs.length > 1) {
      setSearchInputs((prev) => prev.filter((input) => input.id !== inputId));
      if (activeInputId === inputId) {
        setActiveInputId(searchInputs[0].id);
      }
    }
  };

  const handleAssign = async () => {
    if (selectedRefereesData.length === 0) return;
    const refereeIds = selectedRefereesData.map((ref) => ref.userId);
    const matchIds = selectedMatches.map((match) => match.id);
    await onAssign(refereeIds, matchIds);
    setSelectedRefereesData([]);
    setSearchInputs([{ id: "1", value: "" }]);
    setActiveInputId("1");
  };

  const handleClose = () => {
    setSelectedRefereesData([]);
    setSearchInputs([{ id: "1", value: "" }]);
    setActiveInputId("1");
    onClose();
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
    <div className="bulk-assign-referee-modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Bulk Assign Referees</h3>
          <button className="modal-close" onClick={handleClose}>
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
            {/* Selected referees to be assigned */}
            {selectedRefereesData.length > 0 && (
              <div className="selected-referees-section">
                <h4>Referees to Assign ({selectedRefereesData.length})</h4>
                <div className="selected-referees-list">
                  {selectedRefereesData.map((referee) => (
                    <div key={referee.userId} className="selected-referee-item">
                      <div className="referee-info">
                        <h5>
                          {referee.firstName} {referee.lastName}
                        </h5>
                        <p>{referee.email}</p>
                      </div>
                      <button
                        className="remove-button"
                        onClick={() => handleRefereeRemove(referee.userId)}
                        title="Remove referee"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search inputs */}
            <div className="search-inputs-section">
              <h4>Add Referees</h4>
              {searchInputs.map((input, index) => (
                <div key={input.id} className="search-input-row">
                  <div className="input-container">
                    <input
                      type="text"
                      placeholder="Search by name or email..."
                      value={input.value}
                      onChange={(e) => handleInputChange(input.id, e.target.value)}
                      onFocus={() => setActiveInputId(input.id)}
                      className="referee-search-input"
                    />
                    {searchInputs.length > 1 && (
                      <button
                        className="remove-input-button"
                        onClick={() => handleRemoveInput(input.id)}
                        title="Remove search input"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Show suggestions only for the active input */}
                  {activeInputId === input.id && (
                    <div className="suggestions-container">
                      {suggestionsLoading ? (
                        <div className="loading-suggestions">
                          <p>Searching...</p>
                        </div>
                      ) : playerSuggestions.length === 0 ? (
                        debouncedSearchTerm && (
                          <div className="no-suggestions">
                            <p>No referees found matching "{debouncedSearchTerm}"</p>
                          </div>
                        )
                      ) : (
                        <div className="suggestions-list">
                          {playerSuggestions
                            .filter(
                              (referee) => !selectedRefereesData.some((selected) => selected.userId === referee.userId)
                            )
                            .map((referee) => (
                              <div
                                key={referee.id}
                                className="suggestion-item"
                                onClick={() => handleRefereeSelect(referee)}
                              >
                                <div className="referee-info">
                                  <h5>
                                    {referee.firstName} {referee.lastName}
                                  </h5>
                                  <p>{referee.email}</p>
                                  <p className="nationality">
                                    {referee.nationality} • {referee.gender}
                                  </p>
                                </div>
                                <div className="add-icon">+</div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Add another referee button */}
              <button className="add-referee-button" onClick={handleAddRefereeInput}>
                + Add Another Referee
              </button>
            </div>

            {/* Assign button */}
            {selectedRefereesData.length > 0 && (
              <div className="assign-actions">
                <button className="btn-base btn-primary assign-button" onClick={handleAssign} disabled={loading}>
                  {loading
                    ? "Assigning..."
                    : `Assign ${selectedRefereesData.length} Referee${selectedRefereesData.length > 1 ? "s" : ""} to ${
                        selectedMatches.length
                      } Match${selectedMatches.length !== 1 ? "es" : ""}`}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkAssignRefereeModal;
