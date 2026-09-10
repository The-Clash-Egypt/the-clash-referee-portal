import React, { useState } from "react";
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
  /** What the last assignment did (bulk drawer). */
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
  const [removingTeamId, setRemovingTeamId] = useState<string | null>(null);

  const taken = new Set([...selected, ...assigned].map((team) => team.teamId));
  const term = search.trim().toLowerCase();
  const available = options.filter((team) => !taken.has(team.teamId));
  const visible = term
    ? available.filter((team) => `${team.teamName} ${team.categoryName}`.toLowerCase().includes(term))
    : available;

  const unassign = async (teamId: string) => {
    if (!onUnassign) return;
    setRemovingTeamId(teamId);
    try {
      await onUnassign(teamId);
    } finally {
      setRemovingTeamId(null);
    }
  };

  const pick = (team: RefereeTeamOption) => {
    onSelect(team);
    setSearch("");
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
              aria-label={`Add ${team.teamName}`}
              onClick={() => pick(team)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  pick(team);
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
                    className="remove-button"
                    onClick={() => unassign(team.teamId)}
                    disabled={removingTeamId === team.teamId}
                    title="Unassign referee team"
                    aria-label={`Unassign ${team.teamName}`}
                  >
                    ×
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
                    onClick={() => onRemove(team.teamId)}
                    title="Remove team"
                    aria-label={`Remove ${team.teamName}`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {outcome ? (
        <p className="team-assign-outcome" role="status">
          {outcome}
        </p>
      ) : null}

      <div className="search-inputs-section">
        <h4>Add Referee Teams</h4>
        <div className="search-input-row">
          <div className="input-container">
            <input
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
