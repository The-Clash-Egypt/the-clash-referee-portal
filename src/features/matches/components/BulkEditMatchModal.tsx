import React, { useState, useEffect } from "react";
import { Match, sideDisplayName } from "../types/match";
import type { BulkEditResult, BulkMatchEdit } from "../hooks/useMatchActions";
import {
  formatDateTimeLocal,
  formatShift,
  hasStartTime,
  localInputToIso,
  parseShift,
  reschedulePreview,
  shiftStartTime,
} from "../utils/reschedule";
import { courtName, formatWhen } from "../utils/timeline";
import Drawer from "../../shared/components/Drawer";
import { Button } from "../../../ui/Button";
import { Checkbox } from "../../../ui/Checkbox";
import { Chip } from "../../../ui/Chip";
import { Icon } from "../../../ui/Icon";
import { Segmented } from "../../../ui/Segmented";
import "./SheetForm.scss";
import "./BulkEditMatchModal.scss";

interface BulkEditMatchModalProps {
  isOpen: boolean;
  selectedMatches: Match[];
  onClose: () => void;
  /**
   * Saves the edits; resolves with each match's outcome. When all saved the page closes the sheet; when some failed it
   * leaves just those selected, and the sheet lists them with why.
   */
  onSubmit: (updates: BulkMatchEdit[]) => Promise<BulkEditResult[]>;
  /** Takes a match that couldn't be saved off the sheet (and unticks it). */
  onRemoveMatch?: (matchId: string) => void;
  loading: boolean;
  availableVenues?: string[];
}

type TimeMode = "shift" | "set";

const TIME_MODES: { value: TimeMode; label: string }[] = [
  { value: "shift", label: "Shift by" },
  { value: "set", label: "Set to" },
];
const SHIFT_STEP = 5;
const SHIFT_PRESETS = [-15, 15, 30, 60];
const SAVE_FAILED = "Couldn't save this match. Please try again.";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
/** "−15" with a real minus sign, "+30". */
const presetLabel = (minutes: number) => (minutes < 0 ? `−${-minutes}` : `+${minutes}`);

const NO_FIELDS = { venue: false, startTime: false, bestOf: false };

const BulkEditMatchModal: React.FC<BulkEditMatchModalProps> = ({
  isOpen,
  selectedMatches,
  onClose,
  onSubmit,
  onRemoveMatch,
  loading,
  availableVenues = [],
}) => {
  const [venue, setVenue] = useState<string>("");
  const [bestOf, setBestOf] = useState<number | null>(null);
  const [timeMode, setTimeMode] = useState<TimeMode>("shift");
  const [shiftText, setShiftText] = useState("0");
  const [setTo, setSetTo] = useState("");
  const [applyToAll, setApplyToAll] = useState(NO_FIELDS);
  const [errors, setErrors] = useState<string[]>([]);
  // After a save where some matches failed: why each one failed, and how the save went.
  const [failures, setFailures] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<{ saved: number; failed: number } | null>(null);

  // A fresh form every time the sheet opens. While it's open (a save where some failed), what was picked stays.
  useEffect(() => {
    if (!isOpen) return;
    setVenue("");
    setBestOf(null);
    setTimeMode("shift");
    setShiftText("0");
    setSetTo("");
    setApplyToAll(NO_FIELDS);
    setErrors([]);
    setFailures({});
    setOutcome(null);
  }, [isOpen]);

  const timed = selectedMatches.filter((match) => hasStartTime(match.startTime));
  const untimedCount = selectedMatches.length - timed.length;
  const shiftMinutes = parseShift(shiftText);
  const setToIso = localInputToIso(setTo);

  /** The match's new start time, or undefined when its time stays (not applied, nothing picked, no time to shift). */
  const newStartTime = (match: Match): string | undefined => {
    if (!applyToAll.startTime) return undefined;
    if (timeMode === "set") return setToIso ?? undefined;
    if (!hasStartTime(match.startTime) || Number.isNaN(shiftMinutes) || shiftMinutes === 0) return undefined;
    return shiftStartTime(match.startTime, shiftMinutes);
  };

  const preview = applyToAll.startTime
    ? reschedulePreview(
        (timeMode === "shift" ? timed : selectedMatches).map((match) => ({
          from: match.startTime,
          to: newStartTime(match),
        }))
      )
    : "";

  const changeTimeMode = (mode: string) => {
    setTimeMode(mode as TimeMode);
    // "Set to" starts from the selection's earliest time, so the date is already right.
    if (mode === "set" && setTo === "" && timed.length > 0) {
      const earliest = timed.reduce((first, match) =>
        Date.parse(match.startTime!) < Date.parse(first.startTime!) ? match : first
      );
      setSetTo(formatDateTimeLocal(earliest.startTime));
    }
  };

  const stepShift = (by: number) => setShiftText(formatShift((Number.isNaN(shiftMinutes) ? 0 : shiftMinutes) + by));

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (!applyToAll.venue && !applyToAll.startTime && !applyToAll.bestOf) {
      newErrors.push("Please select at least one field to update");
    }

    if (applyToAll.startTime && timeMode === "shift") {
      if (Number.isNaN(shiftMinutes)) newErrors.push("Shift by a whole number of minutes");
      else if (shiftMinutes === 0) newErrors.push("Choose how many minutes to shift by");
      else if (timed.length === 0) newErrors.push("None of the selected matches has a start time to shift");
    }
    if (applyToAll.startTime && timeMode === "set" && !setToIso) {
      newErrors.push("Choose the new start time");
    }

    if (applyToAll.bestOf) {
      if (bestOf === null) newErrors.push("Choose a Best Of value");
      else if (bestOf < 1 || bestOf > 7) newErrors.push("Best of must be between 1 and 7");
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    const updates = selectedMatches
      .map((match) => {
        const update: BulkMatchEdit = { matchId: match.id };
        if (applyToAll.venue) update.venue = venue.trim() || null;
        const startTime = newStartTime(match);
        if (startTime) update.startTime = startTime;
        if (applyToAll.bestOf && bestOf !== null) update.bestOf = bestOf;
        return update;
      })
      // A match with nothing to change (no time to shift, nothing else applied) isn't sent.
      .filter((update) => Object.keys(update).length > 1);

    let results: BulkEditResult[];
    try {
      results = await onSubmit(updates);
    } catch (error) {
      console.error("Error bulk updating matches:", error);
      results = updates.map(({ matchId }) => ({ matchId, ok: false, error: SAVE_FAILED }));
    }

    const failed = results.filter((result) => !result.ok);
    setFailures(Object.fromEntries(failed.map((result) => [result.matchId, result.error || SAVE_FAILED])));
    setOutcome(failed.length > 0 ? { saved: results.length - failed.length, failed: failed.length } : null);
  };

  const handleClose = () => {
    setErrors([]);
    onClose();
  };

  const failedMatches = selectedMatches.filter((match) => failures[match.id]);
  const failureTitle = (() => {
    if (!outcome) return "";
    const which = outcome.failed === 1 ? "This one" : `These ${outcome.failed}`;
    if (outcome.saved > 0) {
      return `Updated ${outcome.saved} of ${plural(outcome.saved + outcome.failed, "match", "matches")}. ${which} couldn't be saved:`;
    }
    return outcome.failed === 1 ? "This match couldn't be saved:" : `These ${outcome.failed} matches couldn't be saved:`;
  })();

  // The drawer supplies the header, close button, Escape, backdrop click and scroll lock.
  return (
    <Drawer
      isOpen={isOpen && selectedMatches.length > 0}
      onClose={handleClose}
      title="Bulk Edit Matches"
      size="md"
      className="bulk-edit-match-drawer sheet-form"
      footer={
        <div className="drawer__actions">
          <Button variant="ghost" size="lg" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button size="lg" onClick={handleSubmit} loading={loading}>
            {loading ? "Updating..." : `Update ${selectedMatches.length} Match${selectedMatches.length !== 1 ? "es" : ""}`}
          </Button>
        </div>
      }
    >
      <div className="matches-count">
        <span className="count-label">Selected Matches:</span>
        <span className="count-value">{selectedMatches.length}</span>
      </div>

      {failedMatches.length > 0 ? (
        <div className="edit-failures" role="alert">
          <p className="edit-failures__title">{failureTitle}</p>
          <ul className="edit-failures__list">
            {failedMatches.map((match) => {
              const teams = `${sideDisplayName(match.homeTeamName, match.homeTeam2Name)} vs ${sideDisplayName(
                match.awayTeamName,
                match.awayTeam2Name
              )}`;
              return (
                <li key={match.id} className="edit-failure">
                  <div className="edit-failure__head">
                    <span className="edit-failure__when">{formatWhen(match.startTime) || "No time"}</span>
                    <span className="edit-failure__teams">{teams}</span>
                    {onRemoveMatch ? (
                      <button
                        type="button"
                        className="edit-failure__remove"
                        onClick={() => onRemoveMatch(match.id)}
                        disabled={loading}
                        aria-label={`Remove ${teams} from this list`}
                        title="Remove from this list"
                      >
                        <Icon name="close" size={14} />
                      </button>
                    ) : null}
                  </div>
                  <span className="edit-failure__court">{courtName(match.venue)}</span>
                  <p className="edit-failure__message">{failures[match.id]}</p>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="info-box">
        <p>Select the fields you want to update for all selected matches. Leave fields unchecked to keep their current values.</p>
      </div>

      <div className="form-group">
        <div className="checkbox-group">
          <Checkbox
            checked={applyToAll.venue}
            onChange={(checked) => setApplyToAll({ ...applyToAll, venue: checked })}
            label="Update Venue"
          />
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
              aria-label="Venue"
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
          <Checkbox
            checked={applyToAll.startTime}
            onChange={(checked) => setApplyToAll({ ...applyToAll, startTime: checked })}
            label="Update Start Time"
          />
        </div>
        {applyToAll.startTime && (
          <div className="field-input">
            <div className="time-mode">
              <Segmented ariaLabel="Change start time" options={TIME_MODES} value={timeMode} onChange={changeTimeMode} />
            </div>

            {timeMode === "shift" ? (
              <>
                <div className="time-shift">
                  <Button
                    variant="ghost"
                    icon="minus"
                    className="time-shift__step"
                    onClick={() => stepShift(-SHIFT_STEP)}
                    aria-label={`${SHIFT_STEP} minutes earlier`}
                  />
                  <div className="time-shift__field">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={5}
                      value={shiftText}
                      onChange={(e) => setShiftText(e.target.value)}
                      onFocus={(e) => e.currentTarget.select()}
                      className="form-input time-shift__input"
                      aria-label="Shift by (minutes)"
                    />
                    <span className="time-shift__unit" aria-hidden="true">
                      min
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    icon="plus"
                    className="time-shift__step"
                    onClick={() => stepShift(SHIFT_STEP)}
                    aria-label={`${SHIFT_STEP} minutes later`}
                  />
                </div>
                <div className="time-shift__presets">
                  {SHIFT_PRESETS.map((minutes) => (
                    <Chip
                      key={minutes}
                      selected={shiftMinutes === minutes}
                      onClick={() => setShiftText(formatShift(minutes))}
                      aria-label={`Shift by ${formatShift(minutes)} minutes`}
                    >
                      {presetLabel(minutes)}
                    </Chip>
                  ))}
                </div>
                {untimedCount > 0 ? (
                  <small className="form-hint">
                    {untimedCount === 1
                      ? "1 match has no time and stays as it is"
                      : `${untimedCount} matches have no time and stay as they are`}
                  </small>
                ) : null}
              </>
            ) : (
              <>
                <input
                  type="datetime-local"
                  value={setTo}
                  onChange={(e) => setSetTo(e.target.value)}
                  className="form-input"
                  aria-label="New start time"
                />
                <small className="form-hint">Every selected match starts at this time</small>
              </>
            )}

            {preview ? (
              <p className="time-preview" aria-live="polite">
                <Icon name="clock" size={15} className="time-preview__icon" />
                {preview}
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div className="form-group">
        <div className="checkbox-group">
          <Checkbox
            checked={applyToAll.bestOf}
            onChange={(checked) => setApplyToAll({ ...applyToAll, bestOf: checked })}
            label="Update Best Of"
          />
        </div>
        {applyToAll.bestOf && (
          <div className="field-input">
            <div className="sheet-select">
              <select
                value={bestOf || ""}
                onChange={(e) => setBestOf(e.target.value ? Number(e.target.value) : null)}
                className="form-input"
                aria-label="Best Of"
              >
                <option value="">Select Best Of</option>
                <option value={1}>Best of 1</option>
                <option value={3}>Best of 3</option>
                <option value={5}>Best of 5</option>
                <option value={7}>Best of 7</option>
              </select>
              <Icon name="chevron-down" size={14} className="sheet-select__icon" />
            </div>
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
    </Drawer>
  );
};

export default BulkEditMatchModal;
