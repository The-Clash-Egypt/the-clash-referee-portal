import React, { useId } from "react";
import { Checkbox } from "../../../ui/Checkbox";
import { RefereeTeam, RefereeTeamOption } from "../types/match";
import { initials } from "../utils/matchDisplay";
import { onEnterKey } from "./RefereeSheetParts";
import "./RefereeSheet.scss";

interface RefereeTeamsSectionProps {
  /** Teams that can referee the sheet's match(es). */
  options: RefereeTeamOption[];
  loading: boolean;
  failed: boolean;
  /** Picked in this sheet, waiting for the footer's Assign button: ticked. */
  selected: RefereeTeamOption[];
  onSelect: (team: RefereeTeamOption, fromKeyboard: boolean) => void;
  onRemove: (teamId: string, fromKeyboard: boolean) => void;
  /** The match's current referee teams (one-match sheet): not offered again, they sit on top as chips. */
  assigned?: RefereeTeam[];
  /** The sheet's one search: teams whose name or category contain it stay listed (picked ones always do). */
  term: string;
  /** In the heading, "Referee teams · Men's Open", when the teams share one category. */
  category?: string;
  /** A team's second line, also part of its name, so same-named teams stay apart (bulk: category · eligible N of M). */
  detailFor?: (team: RefereeTeamOption) => string;
  /** Without a detail, show the team's category as its second line (one match). */
  showCategory?: boolean;
  emptyText: string;
}

/**
 * The "Referee teams" block of the referee sheet (mockup match-flow-v2.html phone 4): the teams allowed to referee
 * the match(es), as checkbox rows filtered by the sheet's search.
 */
const RefereeTeamsSection: React.FC<RefereeTeamsSectionProps> = ({
  options,
  loading,
  failed,
  selected,
  onSelect,
  onRemove,
  assigned = [],
  term,
  category,
  detailFor,
  showCategory = false,
  emptyText,
}) => {
  const headingId = useId();
  const assignedIds = new Set(assigned.map((team) => team.teamId));
  const pickedIds = new Set(selected.map((team) => team.teamId));
  const needle = term.trim().toLowerCase();
  const available = options.filter((team) => !assignedIds.has(team.teamId));
  const visible = needle
    ? available.filter(
        (team) => pickedIds.has(team.teamId) || `${team.teamName} ${team.categoryName}`.toLowerCase().includes(needle)
      )
    : available;

  let body: React.ReactNode;
  if (loading) {
    body = <p className="ref-sheet__note">Loading teams...</p>;
  } else if (failed && options.length === 0) {
    body = <p className="ref-sheet__note">Couldn't load the referee teams. Close and reopen to try again.</p>;
  } else if (visible.length === 0) {
    let message = emptyText;
    if (needle) message = `No teams found matching "${term.trim()}"`;
    else if (options.length > 0) message = "No other teams to add."; // every option already referees the match
    body = <p className="ref-sheet__note">{message}</p>;
  } else {
    body = (
      <ul className="ref-sheet__rows">
        {visible.map((team) => {
          const detail = detailFor?.(team) ?? "";
          const line = detail || (showCategory ? team.categoryName : "");
          const picked = pickedIds.has(team.teamId);
          const toggle = (keyboard: boolean) => (picked ? onRemove(team.teamId, keyboard) : onSelect(team, keyboard));
          return (
            <li key={team.teamId}>
              <Checkbox
                className="ref-row"
                checked={picked}
                onChange={() => toggle(false)}
                onKeyDown={onEnterKey(() => toggle(true))}
                label={detail ? `${team.teamName}, ${detail}` : team.teamName}
              >
                <span className="ref-row__avatar ref-row__avatar--team" aria-hidden="true">
                  {initials(team.teamName)}
                </span>
                <span className="ref-row__who">
                  {team.teamName}
                  {line ? <small>{line}</small> : null}
                </span>
              </Checkbox>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section className="ref-sheet__section" aria-labelledby={headingId}>
      <h3 id={headingId} className="ref-sheet__label">
        {category ? `Referee teams · ${category}` : "Referee teams"}
      </h3>
      {body}
    </section>
  );
};

export default RefereeTeamsSection;
