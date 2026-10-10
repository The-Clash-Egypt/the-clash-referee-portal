import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Venue, UpdateVenueDTO } from "../types/venue";
import { Button } from "../../../ui/Button";
import { Icon } from "../../../ui/Icon";
import "./VenueCard.scss";

interface VenueCardProps {
  venue: Venue;
  onUpdate: (id: string, data: UpdateVenueDTO) => void;
  onShare?: (venue: Venue) => void;
  onShowQRCode?: (venue: Venue) => void;
  onForceGenerateToken?: (venue: Venue) => void;
  showActions?: boolean;
  loadingAction?: "share" | "regenerate" | "qrCode" | null;
  isUpdating?: boolean;
}

/** "expires in 5h 12m" / "expired" for the court's current link ("" when unknown). */
const linkExpiry = (expiry: string | null | undefined): string => {
  if (!expiry) return "";
  const diffMs = new Date(expiry).getTime() - Date.now();
  if (Number.isNaN(diffMs)) return "";
  if (diffMs < 0) return "expired";
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return diffHours > 0 ? `expires in ${diffHours}h ${diffMinutes}m` : `expires in ${diffMinutes}m`;
};

/**
 * One court (mockup rest-of-portal.html phone 3): its name (tap to rename), the lock in one tap, how many of its
 * matches are done, its password (masked; show or edit it), and QR · Share · Password · ⋯ (Rename, New link).
 * Every change goes through `onUpdate` with today's payloads.
 */
const VenueCard: React.FC<VenueCardProps> = ({
  venue,
  onUpdate,
  onShare,
  onShowQRCode,
  onForceGenerateToken,
  showActions = true,
  loadingAction = null,
  isUpdating = false,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [editedName, setEditedName] = useState(venue.name);
  const [editedPassword, setEditedPassword] = useState(venue.password || "");
  const [menuOpen, setMenuOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const nameEditContainerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Focus the field when editing starts.
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

  // The court changed on the server: start any edit from what it is now.
  useEffect(() => {
    setEditedName(venue.name);
    setEditedPassword(venue.password || "");
  }, [venue.name, venue.password]);

  const handleNameCancel = useCallback(() => {
    setEditedName(venue.name);
    setIsEditingName(false);
  }, [venue.name]);

  // A tap outside the name field cancels the rename (as before).
  useEffect(() => {
    if (!isEditingName) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (nameEditContainerRef.current && !nameEditContainerRef.current.contains(event.target as Node)) {
        handleNameCancel();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditingName, handleNameCancel]);

  // The ⋯ menu closes on a tap outside it, or on Escape (focus goes back to ⋯).
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuRef.current?.querySelector<HTMLButtonElement>(".court-card__more-btn")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const handleNameSave = () => {
    if (editedName.trim() && editedName !== venue.name) {
      onUpdate(venue.id, { name: editedName.trim(), isLocked: venue.isLocked });
    }
    setIsEditingName(false);
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

  const editKeys = (save: () => void, cancel: () => void) => (event: React.KeyboardEvent) => {
    if (event.key === "Enter") save();
    else if (event.key === "Escape") cancel();
  };

  const startRename = () => {
    setMenuOpen(false);
    setIsEditingName(true);
  };

  const newLink = () => {
    setMenuOpen(false);
    onForceGenerateToken?.(venue);
  };

  const busy = loadingAction !== null || isUpdating;
  const total = venue.totalMatchCount;
  const done = Math.min(venue.completedMatchCount ?? 0, total ?? 0);
  const percent = total ? Math.round((done / total) * 100) : 0;
  const hasPassword = Boolean(venue.password && venue.password.trim() !== "");
  const canRegenerate = Boolean(onForceGenerateToken && venue.accessToken);
  const expiry = linkExpiry(venue.accessTokenExpiry);

  return (
    <article
      className={`court-card${venue.isLocked ? " court-card--locked" : ""}${isUpdating ? " court-card--updating" : ""}${
        menuOpen ? " court-card--menu-open" : ""
      }`}
      aria-label={venue.name}
    >
      <div className="court-card__head">
        {isEditingName ? (
          <div className="court-card__edit court-card__edit--name" ref={nameEditContainerRef}>
            <input
              ref={nameInputRef}
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onKeyDown={editKeys(handleNameSave, handleNameCancel)}
              className="court-card__input court-card__input--name"
              aria-label="Court name"
              disabled={isUpdating}
            />
            <button
              type="button"
              className="court-card__square court-card__square--save"
              onClick={handleNameSave}
              disabled={isUpdating || !editedName.trim()}
              aria-label="Save name"
            >
              <Icon name="check" size={16} />
            </button>
            <button
              type="button"
              className="court-card__square"
              onClick={handleNameCancel}
              disabled={isUpdating}
              aria-label="Cancel rename"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        ) : (
          <h3 className="court-card__title">
            <button
              type="button"
              className="court-card__name"
              onClick={() => setIsEditingName(true)}
              aria-label={`Rename ${venue.name}`}
              title="Rename"
            >
              {venue.name}
            </button>
          </h3>
        )}
        <button
          type="button"
          className={`court-card__lock ${venue.isLocked ? "court-card__lock--locked" : "court-card__lock--open"}`}
          onClick={handleLockToggle}
          disabled={isUpdating}
          title={`Click to ${venue.isLocked ? "unlock" : "lock"} venue`}
        >
          <Icon name={venue.isLocked ? "lock" : "unlock"} size={12} />
          {venue.isLocked ? "Locked" : "Open"}
        </button>
      </div>

      {total !== undefined ? (
        <div className="court-card__progress">
          <span>
            {done} of {total} done
          </span>
          <span className="court-card__bar" aria-hidden="true">
            <i style={{ width: `${percent}%` }} />
          </span>
        </div>
      ) : null}

      {isEditingPassword ? (
        <div className="court-card__edit court-card__edit--password">
          <input
            ref={passwordInputRef}
            type="text"
            value={editedPassword}
            onChange={(e) => setEditedPassword(e.target.value)}
            onKeyDown={editKeys(handlePasswordSave, handlePasswordCancel)}
            className="court-card__input"
            placeholder="Enter password"
            aria-label="Password"
            autoComplete="off"
            disabled={isUpdating}
          />
          <button
            type="button"
            className="court-card__square court-card__square--save"
            onClick={handlePasswordSave}
            disabled={isUpdating}
            aria-label="Save password"
          >
            <Icon name="check" size={16} />
          </button>
          <button
            type="button"
            className="court-card__square"
            onClick={handlePasswordCancel}
            disabled={isUpdating}
            aria-label="Cancel password edit"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      ) : (
        <div className="court-card__password">
          {hasPassword ? (
            <>
              Password{" "}
              <b className={isPasswordVisible ? "court-card__secret court-card__secret--shown" : "court-card__secret"}>
                {isPasswordVisible ? venue.password : "••••"}
              </b>
              <button
                type="button"
                className="court-card__peek"
                onClick={() => setIsPasswordVisible((visible) => !visible)}
                disabled={isUpdating}
                aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                aria-pressed={isPasswordVisible}
                title={isPasswordVisible ? "Hide password" : "Show password"}
              >
                <Icon name={isPasswordVisible ? "eye-off" : "eye"} size={16} />
              </button>
            </>
          ) : (
            "No password"
          )}
        </div>
      )}

      {showActions ? (
        <div className="court-card__actions">
          {onShowQRCode ? (
            <Button
              variant="tint"
              size="sm"
              icon="qr"
              className="court-card__action"
              onClick={() => onShowQRCode(venue)}
              disabled={busy}
              loading={loadingAction === "qrCode"}
            >
              QR
            </Button>
          ) : null}
          {onShare ? (
            <Button
              variant="tint"
              size="sm"
              icon="share"
              className="court-card__action"
              onClick={() => onShare(venue)}
              disabled={busy}
              loading={loadingAction === "share"}
            >
              Share
            </Button>
          ) : null}
          <Button
            variant="tint"
            size="sm"
            icon="lock"
            className="court-card__action"
            onClick={() => setIsEditingPassword(true)}
            disabled={isUpdating || isEditingPassword}
          >
            Password
          </Button>
          <div className="court-card__more" ref={menuRef}>
            <Button
              variant="ghost"
              size="sm"
              icon="more"
              className="court-card__more-btn"
              aria-label={`More for ${venue.name}`}
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((open) => !open)}
              loading={loadingAction === "regenerate"}
            />
            <div className="court-card__menu" id={menuId} hidden={!menuOpen}>
              <div className="court-card__menu-card">
                <button type="button" className="court-card__menu-item" onClick={startRename} disabled={isUpdating}>
                  <span className="court-card__menu-icon" aria-hidden="true">
                    <Icon name="edit" size={15} />
                  </span>
                  Rename
                </button>
                {canRegenerate ? (
                  <button type="button" className="court-card__menu-item" onClick={newLink} disabled={busy}>
                    <span className="court-card__menu-icon" aria-hidden="true">
                      <Icon name="link" size={15} />
                    </span>
                    <span>
                      New link
                      {expiry ? <small className="court-card__menu-sub">Current link {expiry}</small> : null}
                    </span>
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
};

export default VenueCard;
