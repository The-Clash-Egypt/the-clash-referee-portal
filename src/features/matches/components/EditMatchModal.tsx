import React, { useState, useEffect } from "react";
import { Match } from "../types/match";
import "./EditMatchModal.scss";

// Helper function to convert date to local datetime-local format
const formatDateTimeLocal = (dateString: string): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";

  // Get local date components
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

interface EditMatchModalProps {
  isOpen: boolean;
  match: Match | null;
  onClose: () => void;
  onSubmit: (data: { venue?: string | null; startTime?: string | null; bestOf?: number | null }) => Promise<void>;
  loading: boolean;
  availableVenues?: string[];
}

const EditMatchModal: React.FC<EditMatchModalProps> = ({
  isOpen,
  match,
  onClose,
  onSubmit,
  loading,
  availableVenues = [],
}) => {
  const [venue, setVenue] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [bestOf, setBestOf] = useState<number>(1);
  const [errors, setErrors] = useState<string[]>([]);

  // Initialize form when match changes
  useEffect(() => {
    if (match && isOpen) {
      setVenue(match.venue || "");
      setStartTime(match.startTime ? formatDateTimeLocal(match.startTime) : "");
      setBestOf(match.bestOf || 1);
      setErrors([]);
    }
  }, [match, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (bestOf < 1 || bestOf > 7) {
      newErrors.push("Best of must be between 1 and 7");
    }

    if (startTime) {
      const selectedDate = new Date(startTime);
      if (isNaN(selectedDate.getTime())) {
        newErrors.push("Invalid date/time format");
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const updateData: { venue?: string | null; startTime?: string | null; bestOf?: number | null } = {};

      // Only include fields that have changed
      if (venue !== (match?.venue || "")) {
        updateData.venue = venue.trim() || null;
      }
      const originalStartTime = match?.startTime ? formatDateTimeLocal(match.startTime) : "";
      if (startTime !== originalStartTime) {
        updateData.startTime = startTime ? new Date(startTime).toISOString() : null;
      }
      if (bestOf !== (match?.bestOf || 1)) {
        updateData.bestOf = bestOf;
      }

      // Only submit if there are changes
      if (Object.keys(updateData).length > 0) {
        await onSubmit(updateData);
      }

      onClose();
    } catch (error) {
      console.error("Error updating match:", error);
    }
  };

  const handleClose = () => {
    setVenue("");
    setStartTime("");
    setBestOf(1);
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

  if (!isOpen || !match) return null;

  return (
    <div className="edit-match-modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Match Details</h3>
          <button className="modal-close" onClick={handleClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="match-info-header">
            <p className="match-teams">
              {match.homeTeamName ? match.homeTeamName : "TBD"} vs {match.awayTeamName ? match.awayTeamName : "TBD"}
            </p>
            <div className="match-info-badges">
              {match.format && <span className="format-badge">{match.format}</span>}
              {match.round && <span className="round-badge">{match.round}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="venue">Venue</label>
            <input
              type="text"
              id="venue"
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

          <div className="form-group">
            <label htmlFor="startTime">Start Time</label>
            <input
              type="datetime-local"
              id="startTime"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="form-input"
            />
            <small className="form-hint">Leave empty to keep current time</small>
          </div>

          <div className="form-group">
            <label htmlFor="bestOf">Best Of</label>
            <select
              id="bestOf"
              value={bestOf}
              onChange={(e) => setBestOf(Number(e.target.value))}
              className="form-input"
            >
              <option value={1}>Best of 1</option>
              <option value={3}>Best of 3</option>
              <option value={5}>Best of 5</option>
              <option value={7}>Best of 7</option>
            </select>
            <small className="form-hint">Number of games in the match</small>
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
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditMatchModal;
