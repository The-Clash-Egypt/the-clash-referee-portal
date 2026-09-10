import React, { useRef, useState } from "react";
import { RefereeTeam, RefereeTeamOption } from "../types/match";
import "./RefereeTeamsSection.scss";

interface RefereeTeamsSectionProps {
  /** Teams that can referee the drawer's match(es). */
  options: RefereeTeamOption[];
  loading: boolean;
  failed: boolean;
  /** Picked in this session, waiting for the footer's Assign button. */
  selected: RefereeTeamOption[];
  onSelect: (team: RefereeTeamOption) => void;
  onRemove: (teamId: string) => void;
  /** The match's current referee teams (single-match drawer), each with an unassign control. */
  assigned?: RefereeTeam[];
  onUnassign?: (teamId: string) => Promise<void>;
  /** A team's second line, e.g. its category. */
  detailFor?: (team: RefereeTeamOption) => string;
  emptyText: string;
  /**
   * What the last assignment did (bulk drawer). Passing it, even as null, keeps the empty live region
   * mounted, so its text is announced when it arrives.
   */
  outcome?: string | null;
}

/**
 * The "Referee teams" block of the Assign and Bulk Assign drawers. It is built from the drawers'
 * own cards (blue current, green selected, the suggestion list) so it reads as part of them.
 */
const RefereeTeamsSection: React.FC<RefereeTeamsSectionProps> = ({
  options,
  loading,
  failed,
  selected,
  onSelect,
  onRemove,
  assigned = [],
  onUnassign,
  detailFor,
  emptyText,
  outcome,
}) => {
  const [search, setSearch] = useState("");
  // One unassign at a time: each refreshes the list, and overlapping refreshes can land out of order.
  const [unassigning, setUnassigning] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // The control a keyboard user just used leaves the list, so keep them in the drawer, on the search.
  // Keyboard and assistive-tech activation fires click with detail 0, a tap or mouse click detail >= 1;
  // focusing the input after a tap would only pop the phone keyboard.
  const keepFocus = (fromKeyboard: boolean) => {
    if (fromKeyboard) searchRef.current?.focus();
  };
  const isKeyboardClick = (event: React.MouseEvent) => event.detail === 0;

  const taken = new Set([...selected, ...assigned].map((team) => team.teamId));
  const term = search.trim().toLowerCase();
  const available = options.filter((team) => !taken.has(team.teamId));
  const visible = term
    ? available.filter((team) => `${team.teamName} ${team.categoryName}`.toLowerCase().includes(term))
    : available;

  const unassign = async (team: RefereeTeam, fromKeyboard: boolean) => {
    if (!onUnassign || unassigning || !window.confirm(`Unassign ${team.teamName}?`)) return;
    setUnassigning(true);
    try {
      await onUnassign(team.teamId);
    } finally {
      setUnassigning(false);
      keepFocus(fromKeyboard);
    }
  };

  const pick = (team: RefereeTeamOption, fromKeyboard: boolean) => {
    onSelect(team);
    setSearch("");
    keepFocus(fromKeyboard);
  };

  const remove = (teamId: string, fromKeyboard: boolean) => {
    onRemove(teamId);
    keepFocus(fromKeyboard);
  };

  // "Add Falcons, Men's Open · eligible for 1 of 3 matches": the detail tells same-named teams apart.
  const nameWithDetail = (verb: string, team: RefereeTeamOption) => {
    const detail = detailFor?.(team);
    return detail ? `${verb} ${team.teamName}, ${detail}` : `${verb} ${team.teamName}`;
  };

  const renderList = () => {
    if (loading) {
      return (
        <div className="loading-suggestions">
          <p>Loading teams...</p>
        </div>
      );
    }
    if (failed && options.length === 0) {
      return (
        <div className="no-suggestions">
          <p>Couldn't load the referee teams. Close and reopen to try again.</p>
        </div>
      );
    }
    if (visible.length === 0) {
      let message = emptyText;
      if (term) message = `No teams found matching "${search.trim()}"`;
      else if (options.length > 0) message = "No other teams to add."; // every option is already picked or assigned
      return (
        <div className="no-suggestions">
          <p>{message}</p>
        </div>
      );
    }
    return (
      <div className="suggestions-list">
        {visible.map((team) => {
          const detail = detailFor?.(team);
          return (
            <div
              key={team.teamId}
              className="suggestion-item"
              role="button"
              tabIndex={0}
              aria-label={nameWithDetail("Add", team)}
              onClick={(event) => pick(team, isKeyboardClick(event))}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  pick(team, true);
                }
              }}
            >
              <div className="referee-info">
                <h5>{team.teamName}</h5>
                {detail ? <p>{detail}</p> : null}
              </div>
              <div className="add-icon">+</div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="referees-section referee-teams-section">
      {assigned.length > 0 && (
        <div className="assigned-referees-section">
          <h4>Currently Assigned Referee Teams</h4>
          <div className="assigned-referees-list">
            {assigned.map((team) => (
              <div key={team.teamId} className="assigned-referee-item">
                <div className="referee-info">
                  <h5>{team.teamName}</h5>
                </div>
                {onUnassign && (
                  <button
                    type="button"
                    className="unassign-button"
                    onClick={(event) => unassign(team, isKeyboardClick(event))}
                    disabled={unassigning}
                    title="Unassign referee team"
                    aria-label={`Unassign ${team.teamName}`}
                  >
                    -
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {selected.length > 0 && (
        <div className="selected-referees-section">
          <h4>Referee Teams to Assign ({selected.length})</h4>
          <div className="selected-referees-list">
            {selected.map((team) => {
              const detail = detailFor?.(team);
              return (
                <div key={team.teamId} className="selected-referee-item">
                  <div className="referee-info">
                    <h5>{team.teamName}</h5>
                    {detail ? <p>{detail}</p> : null}
                  </div>
                  <button
                    type="button"
                    className="remove-button"
                    onClick={(event) => remove(team.teamId, isKeyboardClick(event))}
                    title="Remove team"
                    aria-label={nameWithDetail("Remove", team)}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {outcome !== undefined && (
        <div role="status">{outcome ? <p className="team-assign-outcome">{outcome}</p> : null}</div>
      )}

      <div className="search-inputs-section">
        <h4>Add Referee Teams</h4>
        <div className="search-input-row">
          <div className="input-container">
            <input
              ref={searchRef}
              type="text"
              placeholder="Search teams..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="referee-search-input"
              aria-label="Search referee teams"
            />
          </div>
          <div className="suggestions-container">{renderList()}</div>
        </div>
      </div>
    </div>
  );
};

export default RefereeTeamsSection;
