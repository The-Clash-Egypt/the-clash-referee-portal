import React, { useState, useRef, useEffect } from "react";
import { Venue, UpdateVenueDTO } from "../types/venue";
import "./VenueCard.scss";

interface VenueCardProps {
  venue: Venue;
  onUpdate: (id: string, data: UpdateVenueDTO) => void;
  onShare?: (venue: Venue) => void;
  showActions?: boolean;
  isGeneratingToken?: boolean;
  isUpdating?: boolean;
}

const VenueCard: React.FC<VenueCardProps> = ({
  venue,
  onUpdate,
  onShare,
  showActions = true,
  isGeneratingToken = false,
  isUpdating = false,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [editedName, setEditedName] = useState(venue.name);
  const [editedPassword, setEditedPassword] = useState(venue.password || "");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  useEffect(() => {
    if (isEditingPassword && passwordInputRef.current) {
      passwordInputRef.current.focus();
      passwordInputRef.current.select();
    }
  }, [isEditingPassword]);

  // Update local state when venue prop changes
  useEffect(() => {
    setEditedName(venue.name);
    setEditedPassword(venue.password || "");
  }, [venue.name, venue.password]);

  const handleNameEdit = () => {
    setIsEditingName(true);
  };

  const handleNameSave = () => {
    if (editedName.trim() && editedName !== venue.name) {
      onUpdate(venue.id, { name: editedName.trim(), isLocked: venue.isLocked });
    }
    setIsEditingName(false);
  };

  const handleNameCancel = () => {
    setEditedName(venue.name);
    setIsEditingName(false);
  };

  const handlePasswordEdit = () => {
    setIsEditingPassword(true);
  };

  const handlePasswordSave = () => {
    onUpdate(venue.id, { name: venue.name, password: editedPassword.trim() || undefined, isLocked: venue.isLocked });
    setIsEditingPassword(false);
  };

  const handlePasswordCancel = () => {
    setEditedPassword(venue.password || "");
    setIsEditingPassword(false);
  };

  const handleLockToggle = () => {
    onUpdate(venue.id, { name: venue.name, isLocked: !venue.isLocked });
  };

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: "save" | "cancel") => {
    if (e.key === "Enter" && action === "save") {
      if (isEditingName) handleNameSave();
      if (isEditingPassword) handlePasswordSave();
    } else if (e.key === "Escape" && action === "cancel") {
      if (isEditingName) handleNameCancel();
      if (isEditingPassword) handlePasswordCancel();
    }
  };

  return (
    <div className={`venue-card ${venue.isLocked ? "locked" : ""} ${isUpdating ? "updating" : ""}`}>
      <div className="venue-card__header">
        <div className="venue-card__title">
          {isEditingName ? (
            <div className="venue-card__name-edit">
              <input
                ref={nameInputRef}
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={(e) => handleKeyPress(e, "save")}
                onBlur={handleNameSave}
                className="venue-card__name-input"
                disabled={isUpdating}
              />
              <div className="venue-card__edit-actions">
                <button
                  className="venue-card__save-btn"
                  onClick={handleNameSave}
                  disabled={isUpdating || !editedName.trim()}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z" />
                  </svg>
                </button>
                <button className="venue-card__cancel-btn" onClick={handleNameCancel} disabled={isUpdating}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <h3 onClick={handleNameEdit} className="venue-card__name-display">
              {venue.name}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="venue-card__edit-icon">
                <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" />
              </svg>
            </h3>
          )}
        </div>
        <div className="venue-card__status">
          <button
            className={`status-badge ${venue.isLocked ? "locked" : "unlocked"} ${isUpdating ? "disabled" : ""}`}
            onClick={handleLockToggle}
            disabled={isUpdating}
            title={`Click to ${venue.isLocked ? "unlock" : "lock"} venue`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="status-badge__icon">
              {venue.isLocked ? (
                <path d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z" />
              ) : (
                <path d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z" />
              )}
            </svg>
            {venue.isLocked ? "Locked" : "Unlocked"}
          </button>
          {showActions && (
            <div className="venue-card__actions">
              {onShare && (
                <button
                  className="venue-card__share-btn"
                  onClick={() => onShare(venue)}
                  disabled={isGeneratingToken || isUpdating}
                  title="Generate Share Link"
                >
                  {isGeneratingToken ? (
                    <div className="loading-spinner-small"></div>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18,16.08C17.24,16.08 16.56,16.38 16.04,16.85L8.91,12.7C8.96,12.47 9,12.24 9,12C9,11.76 8.96,11.53 8.91,11.3L15.96,7.19C16.5,7.69 17.21,8 18,8A3,3 0 0,0 21,5A3,3 0 0,0 18,2A3,3 0 0,0 15,5C15,5.24 15.04,5.47 15.09,5.7L8.04,9.81C7.5,9.31 6.79,9 6,9A3,3 0 0,0 3,12A3,3 0 0,0 6,15C6.79,15 7.5,14.69 8.04,14.19L15.16,18.34C15.11,18.55 15.08,18.77 15.08,19C15.08,20.61 16.39,21.91 18,21.91C19.61,21.91 20.92,20.61 20.92,19A2.92,2.92 0 0,0 18,16.08Z" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="venue-card__content">
        <div className="venue-card__password">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z" />
          </svg>
          {isEditingPassword ? (
            <div className="venue-card__password-edit">
              <input
                ref={passwordInputRef}
                type="text"
                value={editedPassword}
                onChange={(e) => setEditedPassword(e.target.value)}
                onKeyDown={(e) => handleKeyPress(e, "save")}
                className="venue-card__password-input"
                placeholder="Enter password"
                disabled={isUpdating}
              />
              <div className="venue-card__edit-actions">
                <button className="venue-card__save-btn" onClick={handlePasswordSave} disabled={isUpdating}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z" />
                  </svg>
                </button>
                <button className="venue-card__cancel-btn" onClick={handlePasswordCancel} disabled={isUpdating}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="venue-card__password-display">
              <div className="venue-card__password-content">
                <div className="venue-card__password-text-container">
                  <span>Password: </span>
                  <span
                    className={`venue-card__password-text ${!isPasswordVisible && venue.password ? "blurred" : ""}`}
                  >
                    {venue.password || "Not set"}
                  </span>
                </div>
                <div className="venue-card__password-actions">
                  {venue.password && (
                    <button
                      className="venue-card__password-toggle-btn"
                      onClick={togglePasswordVisibility}
                      disabled={isUpdating}
                      title={isPasswordVisible ? "Hide password" : "Show password"}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        {isPasswordVisible ? (
                          <path d="M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,16.8 12.79,17 12,17A5,5 0 0,1 7,12C7,11.21 7.2,10.47 7.53,9.8M2,4.27L4.28,6.55L4.73,7C3.08,8.3 1.78,10 1,12C2.73,16.39 7,19.5 12,19.5C13.55,19.5 15.03,19.2 16.38,18.66L16.81,19.09L19.73,22L21,20.73L3.27,3M12,7A5,5 0 0,1 17,12C17,12.64 16.87,13.26 16.64,13.82L19.57,16.75C21.07,15.5 22.27,13.86 23.09,12C21.27,7.61 17,4.5 12,4.5C10.6,4.5 9.26,4.75 8,5.2L10.17,7.35C10.76,7.13 11.37,7 12,7Z" />
                        ) : (
                          <path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z" />
                        )}
                      </svg>
                    </button>
                  )}
                  <button
                    className="venue-card__password-edit-btn"
                    onClick={handlePasswordEdit}
                    disabled={isUpdating}
                    title="Edit password"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Admin message explaining lock status */}
        <div className={`venue-card__admin-message ${venue.isLocked ? "venue-card__admin-message--locked" : ""}`}>
          <div className="venue-card__admin-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M11,16.5L18,9.5L16.5,8L11,13.5L7.5,10L6,11.5L11,16.5Z" />
            </svg>
          </div>
          <div className="venue-card__admin-text">
            <strong>Admin Info:</strong>{" "}
            {venue.isLocked ? (
              <span>
                This venue is <strong>locked</strong>. No one can access matches and update scores
              </span>
            ) : (
              <span>
                This venue is <strong>unlocked</strong>. Anyone with the share link can access matches and update scores
                {venue.password ? ". If a password is set, users will need to enter it to access the venue" : ""}.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VenueCard;
