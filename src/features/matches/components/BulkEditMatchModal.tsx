import React, { useState, useEffect } from "react";
import { Match } from "../types/match";
import "./BulkEditMatchModal.scss";

interface BulkEditMatchModalProps {
  isOpen: boolean;
  selectedMatches: Match[];
  onClose: () => void;
  onSubmit: (
    updates: { matchId: string; venue?: string | null; bestOf?: number | null }[]
  ) => Promise<void>;
  loading: boolean;
  availableVenues?: string[];
}

const BulkEditMatchModal: React.FC<BulkEditMatchModalProps> = ({
  isOpen,
  selectedMatches,
  onClose,
  onSubmit,
  loading,
  availableVenues = [],
}) => {
  const [venue, setVenue] = useState<string>("");
  const [bestOf, setBestOf] = useState<number | null>(null);
  const [applyToAll, setApplyToAll] = useState({
    venue: false,
    bestOf: false,
  });
  const [errors, setErrors] = useState<string[]>([]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setVenue("");
      setBestOf(null);
      setApplyToAll({ venue: false, bestOf: false });
      setErrors([]);
    }
  }, [isOpen]);

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (applyToAll.bestOf && bestOf !== null) {
      if (bestOf < 1 || bestOf > 7) {
        newErrors.push("Best of must be between 1 and 7");
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    // Check if at least one field is being applied
    if (!applyToAll.venue && !applyToAll.bestOf) {
      setErrors(["Please select at least one field to update"]);
      return;
    }

    try {
      const updates = selectedMatches.map((match) => {
        const update: { matchId: string; venue?: string | null; bestOf?: number | null } = {
          matchId: match.id,
        };

        if (applyToAll.venue) {
          update.venue = venue.trim() || null;
        }
        if (applyToAll.bestOf && bestOf !== null) {
          update.bestOf = bestOf;
        }

        return update;
      });

      await onSubmit(updates);
      onClose();
    } catch (error) {
      console.error("Error bulk updating matches:", error);
    }
  };

  const handleClose = () => {
    setVenue("");
    setBestOf(null);
    setApplyToAll({ venue: false, bestOf: false });
    setErrors([]);
    onClose();
  };

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

  if (!isOpen || selectedMatches.length === 0) return null;

  return (
    <div className="bulk-edit-match-modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Bulk Edit Matches</h3>
          <button className="modal-close" onClick={handleClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="matches-count">
            <span className="count-label">Selected Matches:</span>
            <span className="count-value">{selectedMatches.length}</span>
          </div>

          <div className="info-box">
            <p>Select the fields you want to update for all selected matches. Leave fields unchecked to keep their current values.</p>
          </div>

          <div className="form-group">
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={applyToAll.venue}
                  onChange={(e) => setApplyToAll({ ...applyToAll, venue: e.target.checked })}
                />
                <span>Update Venue</span>
              </label>
            </div>
            {applyToAll.venue && (
              <div className="field-input">
                <input
                  type="text"
                  list="venue-list"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="Enter venue name"
                  className="form-input"
                />
                <datalist id="venue-list">
                  {availableVenues.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
                <small className="form-hint">Type to search or enter a new venue name</small>
              </div>
            )}
          </div>

          <div className="form-group">
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={applyToAll.bestOf}
                  onChange={(e) => setApplyToAll({ ...applyToAll, bestOf: e.target.checked })}
                />
                <span>Update Best Of</span>
              </label>
            </div>
            {applyToAll.bestOf && (
              <div className="field-input">
                <select
                  value={bestOf || ""}
                  onChange={(e) => setBestOf(e.target.value ? Number(e.target.value) : null)}
                  className="form-input"
                >
                  <option value="">Select Best Of</option>
                  <option value={1}>Best of 1</option>
                  <option value={3}>Best of 3</option>
                  <option value={5}>Best of 5</option>
                  <option value={7}>Best of 7</option>
                </select>
                <small className="form-hint">Number of games in the match</small>
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
            <button className="btn btn-secondary" onClick={handleClose} disabled={loading}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? "Updating..." : `Update ${selectedMatches.length} Match${selectedMatches.length !== 1 ? "es" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkEditMatchModal;

