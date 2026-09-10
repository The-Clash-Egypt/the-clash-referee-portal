import React, { useEffect, useMemo, useRef, useState } from "react";
import { Match, MatchGameScore, isFixedPointsFormat, sideDisplayName } from "../types/match";
import { ScoreCell, ScoreDrafts, scoreCellsFor } from "../../../utils/matchScoreCells";
import { filledCells, gameScoresFromCells, sameCells, validateGameScores } from "../../../utils/scoreValidation";
import { groupMatchesByVenue } from "../../../utils/venueGrouping";
import { formatClock, shouldLabelCategories } from "../../../utils/matchSheetFormat";
import Drawer from "../../shared/components/Drawer";
import "./BulkUpdateScoreModal.scss";

export interface BulkScoreEntry {
  match: Match;
  gameScores: MatchGameScore[];
}

export interface BulkScoreResult {
  matchId: string;
  ok: boolean;
  error?: string;
}

interface BulkUpdateScoreModalProps {
  isOpen: boolean;
  /** The ticked matches, snapshotted by the page when the sheet opened. */
  selectedMatches: Match[];
  /** Takes one match off the sheet and unticks it. */
  onRemoveMatch: (matchId: string) => void;
  /** Saves each entry; resolves with one result per entry (a single failure must not reject). */
  onSave: (entries: BulkScoreEntry[]) => Promise<BulkScoreResult[]>;
  /** Closes the sheet, reporting which matches were saved so the page can untick them. */
  onClose: (savedMatchIds: string[]) => void;
}

type RowState = "saving" | "saved";

function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Every ticked match on one screen, grouped by court (spec §6.3). Scores are validated with the
 * same rules as the single-match dialog; nothing is saved while a changed row has errors unless
 * the user explicitly chooses to skip those rows. Invalid scores are never sent.
 */
const BulkUpdateScoreModal: React.FC<BulkUpdateScoreModalProps> = ({
  isOpen,
  selectedMatches,
  onRemoveMatch,
  onSave,
  onClose,
}) => {
  const [entries, setEntries] = useState<ScoreDrafts>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [failures, setFailures] = useState<Record<string, string>>({});
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // A fresh sheet every time it opens. Selection changes while open keep what was typed.
  useEffect(() => {
    if (!isOpen) return;
    setEntries({});
    setTouched(new Set());
    setRowState({});
    setFailures({});
    setSaveAttempted(false);
    setSaving(false);
  }, [isOpen]);

  const groups = useMemo(() => groupMatchesByVenue(selectedMatches), [selectedMatches]);
  const orderedIds = useMemo(() => groups.flatMap((group) => group.matches.map((match) => match.id)), [groups]);
  const showCategory = shouldLabelCategories(selectedMatches);

  const cellsFor = (match: Match): ScoreCell[] => entries[match.id] ?? scoreCellsFor(match);
  const isSaved = (match: Match) => rowState[match.id] === "saved";
  const isChanged = (match: Match) =>
    !isSaved(match) && !!entries[match.id] && !sameCells(entries[match.id], scoreCellsFor(match));
  const errorsFor = (match: Match) => (isChanged(match) ? validateGameScores(match, cellsFor(match)) : []);

  const changed = selectedMatches.filter(isChanged);
  const invalid = changed.filter((match) => errorsFor(match).length > 0);
  const valid = changed.filter((match) => errorsFor(match).length === 0);
  const savedIds = selectedMatches.filter(isSaved).map((match) => match.id);
  const notEntered = selectedMatches.length - changed.length - savedIds.length;

  const updateCell = (match: Match, gameNumber: number, side: "home" | "away", raw: string) => {
    const digits = raw.replace(/[^0-9]/g, "").slice(0, 3);
    const value = digits === "" ? null : parseInt(digits, 10);

    setEntries((previous) => {
      const base = previous[match.id] ?? scoreCellsFor(match);
      return {
        ...previous,
        [match.id]: base.map((cell) => (cell.gameNumber === gameNumber ? { ...cell, [side]: value } : cell)),
      };
    });
    setFailures((previous) => (previous[match.id] ? withoutKey(previous, match.id) : previous));
  };

  // A row's errors appear once focus leaves the row (or on Save), not on every keystroke.
  const handleRowBlur = (matchId: string) => (event: React.FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setTouched((previous) => (previous.has(matchId) ? previous : new Set(previous).add(matchId)));
  };

  const focusRow = (matchId: string | undefined) => {
    if (!matchId) return;
    const row = bodyRef.current?.querySelector<HTMLElement>(`[data-row="${matchId}"]`);
    row?.scrollIntoView?.({ block: "center" });
    row?.querySelector<HTMLInputElement>("input:not(:disabled)")?.focus();
  };

  const firstInvalidId = () => orderedIds.find((id) => invalid.some((match) => match.id === id));

  const handleKeyDown = (matchId: string) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    focusRow(orderedIds[orderedIds.indexOf(matchId) + 1]);
  };

  const saveRows = async (rows: Match[], closeWhenDone: boolean) => {
    if (rows.length === 0) return;
    setSaving(true);
    setRowState((previous) => ({ ...previous, ...Object.fromEntries(rows.map((match) => [match.id, "saving" as RowState])) }));

    let results: BulkScoreResult[];
    try {
      results = await onSave(rows.map((match) => ({ match, gameScores: gameScoresFromCells(cellsFor(match)) })));
    } catch (error) {
      console.error("Bulk score save failed:", error);
      results = rows.map((match) => ({ matchId: match.id, ok: false, error: "Couldn't save this match. Please try again." }));
    }

    const byId = new Map(results.map((result) => [result.matchId, result]));
    const succeeded = rows.filter((match) => byId.get(match.id)?.ok);

    setRowState((previous) => {
      const next = { ...previous };
      rows.forEach((match) => {
        if (byId.get(match.id)?.ok) next[match.id] = "saved";
        else delete next[match.id];
      });
      return next;
    });
    setFailures((previous) => {
      const next = { ...previous };
      rows.forEach((match) => {
        const result = byId.get(match.id);
        if (result?.ok) delete next[match.id];
        else next[match.id] = result?.error || "Couldn't save this match. Please try again.";
      });
      return next;
    });
    setSaving(false);

    if (closeWhenDone && succeeded.length === rows.length) {
      setSaveAttempted(false);
      onClose([...savedIds, ...succeeded.map((match) => match.id)]);
    }
  };

  const handleSave = () => {
    setSaveAttempted(true);
    if (invalid.length > 0) {
      setTouched((previous) => {
        const next = new Set(previous);
        invalid.forEach((match) => next.add(match.id));
        return next;
      });
      focusRow(firstInvalidId());
      return;
    }
    void saveRows(valid, true);
  };

  const handleSaveValidOnly = () => {
    void saveRows(valid, false);
  };

  const handleClose = () => {
    if (saving) return;
    if (changed.length > 0 && !window.confirm("Discard the scores you've entered?")) return;
    onClose(savedIds);
  };

  const renderStatus = (match: Match, errors: string[]) => {
    const state = rowState[match.id];
    if (state === "saved") return <span className="bulk-status bulk-status--ready">Saved ✓</span>;
    if (state === "saving") return <span className="bulk-status">Saving…</span>;
    if (failures[match.id]) return <span className="bulk-status bulk-status--error">Failed</span>;
    if (!isChanged(match)) {
      return <span className="bulk-status">{match.gameScores?.length ? "No changes" : "Not entered"}</span>;
    }
    if (errors.length === 0) return <span className="bulk-status bulk-status--ready">Ready</span>;
    return touched.has(match.id) ? (
      <span className="bulk-status bulk-status--error">{plural(errors.length, "error", "errors")}</span>
    ) : (
      <span className="bulk-status">Editing</span>
    );
  };

  const renderRow = (match: Match) => {
    const cells = cellsFor(match);
    const home = sideDisplayName(match.homeTeamName, match.homeTeam2Name);
    const away = sideDisplayName(match.awayTeamName, match.awayTeam2Name);
    const fixedPoints = isFixedPointsFormat(match.formatType);
    const locked = rowState[match.id] !== undefined;
    const errors = errorsFor(match);
    const visibleErrors = touched.has(match.id) ? errors : [];
    const failure = failures[match.id];
    const total = filledCells(cells).reduce((sum, cell) => sum + (cell.home ?? 0) + (cell.away ?? 0), 0);
    const columns = `minmax(120px, 220px) repeat(${cells.length}, 48px)${fixedPoints ? " auto" : ""}`;

    return (
      <div
        key={match.id}
        data-row={match.id}
        className={[
          "bulk-row",
          visibleErrors.length > 0 || failure ? "bulk-row--error" : "",
          isSaved(match) ? "bulk-row--saved" : "",
        ].filter(Boolean).join(" ")}
        onBlur={handleRowBlur(match.id)}
      >
        <div className="bulk-row__rail">
          <span className="bulk-row__time">{formatClock(match.startTime)}</span>
          {match.round ? <span className="bulk-row__round">{match.round}</span> : null}
          {showCategory && match.categoryName ? <span className="bulk-row__category">{match.categoryName}</span> : null}
        </div>

        {/* Explicit grid placement lets the DOM run home G1, away G1, home G2… so Tab follows game pairs. */}
        <div className="bulk-row__grid" style={{ gridTemplateColumns: columns }}>
          <span className="bulk-row__team" style={{ gridRow: 2, gridColumn: 1 }}>
            {home}
          </span>
          <span className="bulk-row__team" style={{ gridRow: 3, gridColumn: 1 }}>
            {away}
          </span>
          {cells.map((cell, index) => (
            <React.Fragment key={cell.gameNumber}>
              <span className="bulk-row__label" style={{ gridRow: 1, gridColumn: index + 2 }}>
                {fixedPoints ? "Pts" : `G${cell.gameNumber}`}
              </span>
              {(["home", "away"] as const).map((side) => (
                <input
                  key={side}
                  type="text"
                  inputMode="numeric"
                  maxLength={3}
                  className="bulk-row__input"
                  style={{ gridRow: side === "home" ? 2 : 3, gridColumn: index + 2 }}
                  value={cell[side] === null ? "" : String(cell[side])}
                  disabled={locked}
                  aria-label={`${side === "home" ? home : away} game ${cell.gameNumber}`}
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) => updateCell(match, cell.gameNumber, side, event.target.value)}
                  onKeyDown={handleKeyDown(match.id)}
                />
              ))}
            </React.Fragment>
          ))}
          {fixedPoints && match.pointsPerMatch ? (
            <span className="bulk-row__total" style={{ gridRow: "2 / 4", gridColumn: cells.length + 2 }}>
              {total} / {match.pointsPerMatch} pts
            </span>
          ) : null}
        </div>

        <div className="bulk-row__side">
          {renderStatus(match, errors)}
          {!isSaved(match) ? (
            <button
              type="button"
              className="bulk-row__remove"
              onClick={() => onRemoveMatch(match.id)}
              disabled={saving}
              aria-label={`Remove ${home} vs ${away} from this list`}
              title="Remove from this list"
            >
              ×
            </button>
          ) : null}
        </div>

        {visibleErrors.length > 0 || failure ? (
          <ul className="bulk-row__messages">
            {visibleErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
            {failure ? <li>{failure}</li> : null}
          </ul>
        ) : null}
      </div>
    );
  };

  const summary = [
    valid.length > 0 ? `${valid.length} ready` : null,
    invalid.length > 0 ? `${invalid.length} need${invalid.length === 1 ? "s" : ""} attention` : null,
    notEntered > 0 ? `${notEntered} not entered` : null,
    savedIds.length > 0 ? `${savedIds.length} saved` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // The drawer supplies the header, close button, Escape, backdrop click and scroll lock; every way
  // of closing goes through handleClose, so typed scores still ask before being thrown away.
  return (
    <Drawer
      isOpen={isOpen && selectedMatches.length > 0}
      onClose={handleClose}
      title="Bulk update scores"
      subtitle={`${plural(selectedMatches.length, "match", "matches")} · blank boxes are skipped`}
      size="lg"
      className="bulk-score-drawer"
      footer={
        <div className="bulk-sheet__footer">
          {saveAttempted && invalid.length > 0 ? (
            <div className="bulk-sheet__blocked" role="alert">
              <span>{invalid.length === 1 ? "1 match has errors." : `${invalid.length} matches have errors.`}</span>
              <button type="button" className="btn btn-secondary" onClick={() => focusRow(firstInvalidId())}>
                Review errors
              </button>
              {valid.length > 0 ? (
                <button type="button" className="btn btn-primary" onClick={handleSaveValidOnly} disabled={saving}>
                  Save {valid.length} valid, skip {invalid.length}
                </button>
              ) : null}
            </div>
          ) : (
            <span className="bulk-sheet__summary">{summary}</span>
          )}

          <div className="bulk-sheet__actions">
            <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || changed.length === 0}>
              {saving ? "Saving…" : `Save ${plural(changed.length, "match", "matches")}`}
            </button>
          </div>
        </div>
      }
    >
      <div ref={bodyRef}>
        {groups.map((group) => (
          <section key={group.venue} className="bulk-court">
            <div className="bulk-court__header">
              <h4>{group.venue}</h4>
              <span>{plural(group.matches.length, "match", "matches")}</span>
            </div>
            {group.matches.map(renderRow)}
          </section>
        ))}
      </div>
    </Drawer>
  );
};

export default BulkUpdateScoreModal;
