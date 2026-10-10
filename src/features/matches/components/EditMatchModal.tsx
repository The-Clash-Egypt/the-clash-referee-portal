import React, { useState, useEffect } from "react";
import { Match, TeamMember, sideDisplayName } from "../types/match";
import Drawer from "../../shared/components/Drawer";
import { Button } from "../../../ui/Button";
import { Icon } from "../../../ui/Icon";
import { Tag } from "../../../ui/Tag";
import "./SheetForm.scss";
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

  // Helper function to render team members (max 3, captain indicator only if more than 3)
  const renderTeamMembers = (members: TeamMember[] | undefined) => {
    if (!members || members.length === 0) return null;

    const displayMembers = members.slice(0, 3);
    const hasMore = members.length > 3;

    return (
      <small className="team-members-display">
        {displayMembers.map((member) => (
          <span key={member.id} className="member-name">
            {member.firstName} {member.lastName}
            {hasMore && member.isCaptain && <span className="captain-badge">(C)</span>}
          </span>
        ))}
      </small>
    );
  };

  // The drawer supplies the header, close button, Escape, backdrop click and scroll lock.
  return (
    <Drawer
      isOpen={isOpen && Boolean(match)}
      onClose={handleClose}
      title="Edit Match Details"
      size="md"
      className="edit-match-drawer sheet-form"
      footer={
        <div className="drawer__actions">
          <Button variant="ghost" size="lg" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button size="lg" onClick={handleSubmit} loading={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      }
    >
      {match ? (
        <>
          {/* Teams: home with the orange edge, away with the blue one (the scoreboard's colours). */}
          <div className="teams-section">
            <div className="teams-row">
              <div className="team-card home">
                <span className="team-name">{sideDisplayName(match.homeTeamName, match.homeTeam2Name)}</span>
                {renderTeamMembers(match.homeTeamMembers)}
              </div>
              <div className="team-card away">
                <span className="team-name">{sideDisplayName(match.awayTeamName, match.awayTeam2Name)}</span>
                {renderTeamMembers(match.awayTeamMembers)}
              </div>
            </div>
            {match.format || match.round ? (
              <div className="match-info-badges">
                {match.format && <Tag tone="grey">{match.format}</Tag>}
                {match.round && <Tag tone="grey">{match.round}</Tag>}
              </div>
            ) : null}
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
            <div className="sheet-select">
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
              <Icon name="chevron-down" size={14} className="sheet-select__icon" />
            </div>
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
        </>
      ) : null}
    </Drawer>
  );
};

export default EditMatchModal;
