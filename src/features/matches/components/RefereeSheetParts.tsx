import React, { useId, useState } from "react";
import { Checkbox } from "../../../ui/Checkbox";
import { Icon } from "../../../ui/Icon";
import { PlayerSuggestion, Referee, RefereeTeam, RefereeTeamOption } from "../types/match";
import { initials } from "../utils/matchDisplay";
import "./RefereeSheet.scss";

/** The pieces of the referee sheet (mockup match-flow-v2.html phone 4), shared by the one-match and bulk sheets. */

export const personName = (person: Pick<PlayerSuggestion, "firstName" | "lastName">): string =>
  `${person.firstName || ""} ${person.lastName || ""}`.trim();

/** Enter on a row's checkbox ticks it too (Space already does), and hands focus back to the search. */
export const onEnterKey =
  (run: () => void) =>
  (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    run();
  };

/** Keyboard and assistive-tech activation fires click with detail 0; a tap or a mouse click has detail >= 1. */
const fromKeyboard = (event: React.MouseEvent) => event.detail === 0;

// ---- chips: who is assigned, and who will be ----

interface RefereeChipsProps {
  /** On the match now (one-match sheet): each chip unassigns at once, once confirmed. */
  assignedPeople?: Referee[];
  assignedTeams?: RefereeTeam[];
  onUnassignPerson?: (referee: Referee) => void | Promise<void>;
  onUnassignTeam?: (teamId: string) => Promise<void>;
  /** Picked in this sheet, waiting for the footer's Assign button. */
  pickedPeople: PlayerSuggestion[];
  pickedTeams: RefereeTeamOption[];
  onRemovePerson: (userId: string, fromKeyboard: boolean) => void;
  onRemoveTeam: (teamId: string, fromKeyboard: boolean) => void;
  /** A picked team's detail, part of its remove button's name (bulk: "Men's Open · eligible for 1 of 3 matches"). */
  teamDetail?: (team: RefereeTeamOption) => string;
  /** The control a keyboard user just used may leave the list: keep them in the sheet, on the search. */
  focusSearch: (fromKeyboard: boolean) => void;
}

/**
 * Who referees the match, and who will once saved (mockup `.assigned`): orange people, blue teams. Every chip ends in a
 * ✕: on an assigned chip it unassigns (after a confirm, one at a time, as today's drawer did for teams), on a picked
 * chip it drops the pick. Their names tell them apart ("Unassign …" / "Remove …").
 */
export const RefereeChips: React.FC<RefereeChipsProps> = ({
  assignedPeople = [],
  assignedTeams = [],
  onUnassignPerson,
  onUnassignTeam,
  pickedPeople,
  pickedTeams,
  onRemovePerson,
  onRemoveTeam,
  teamDetail,
  focusSearch,
}) => {
  // One unassign at a time: each refreshes the list, and overlapping refreshes can land out of order.
  const [unassigning, setUnassigning] = useState(false);

  if (assignedPeople.length + assignedTeams.length + pickedPeople.length + pickedTeams.length === 0) return null;

  const unassign = async (name: string, run: () => void | Promise<void>, keyboard: boolean) => {
    if (unassigning || !window.confirm(`Unassign ${name}?`)) return;
    setUnassigning(true);
    try {
      await run();
    } finally {
      setUnassigning(false);
      focusSearch(keyboard);
    }
  };

  const unassignButton = (name: string, title: string, run: () => void | Promise<void>) => (
    <button
      type="button"
      className="ref-chip__btn unassign-button"
      onClick={(event) => unassign(name, run, fromKeyboard(event))}
      disabled={unassigning}
      title={title}
      aria-label={`Unassign ${name}`}
    >
      <Icon name="close" size={12} />
    </button>
  );

  const removeButton = (label: string, title: string, run: (keyboard: boolean) => void) => (
    <button
      type="button"
      className="ref-chip__btn"
      onClick={(event) => run(fromKeyboard(event))}
      title={title}
      aria-label={label}
    >
      <Icon name="close" size={12} />
    </button>
  );

  const teamLabel = (team: RefereeTeamOption) => {
    const detail = teamDetail?.(team);
    return detail ? `${team.teamName}, ${detail}` : team.teamName;
  };

  return (
    <ul className="ref-chips">
      {assignedPeople.map((referee) => (
        <li key={`assigned-${referee.id}`} className="ref-chip">
          <span className="ref-chip__name">{referee.fullName}</span>
          {onUnassignPerson
            ? unassignButton(referee.fullName, "Unassign referee", () => onUnassignPerson(referee))
            : null}
        </li>
      ))}
      {assignedTeams.map((team) => (
        <li key={`assigned-team-${team.teamId}`} className="ref-chip ref-chip--team">
          <span className="ref-chip__name">{team.teamName}</span>
          {onUnassignTeam
            ? unassignButton(team.teamName, "Unassign referee team", () => onUnassignTeam(team.teamId))
            : null}
        </li>
      ))}
      {pickedPeople.map((person) => (
        <li key={`picked-${person.userId}`} className="ref-chip ref-chip--picked">
          <span className="ref-chip__name">{personName(person)}</span>
          {removeButton(`Remove ${personName(person)}`, "Remove referee", (keyboard) =>
            onRemovePerson(person.userId, keyboard)
          )}
        </li>
      ))}
      {pickedTeams.map((team) => (
        <li key={`picked-team-${team.teamId}`} className="ref-chip ref-chip--team ref-chip--picked">
          <span className="ref-chip__name">{team.teamName}</span>
          {removeButton(`Remove ${teamLabel(team)}`, "Remove team", (keyboard) => onRemoveTeam(team.teamId, keyboard))}
        </li>
      ))}
    </ul>
  );
};

// ---- People ----

interface RefereePeopleSectionProps {
  /** The search as sent (after the debounce): people are looked up from 2 letters. */
  term: string;
  results: PlayerSuggestion[];
  loading: boolean;
  picked: PlayerSuggestion[];
  /** Already referee the match (one-match sheet): ticked and fixed here; their chip unassigns them. */
  assignedUserIds?: Set<string>;
  onToggle: (person: PlayerSuggestion, fromKeyboard: boolean) => void;
}

/** People found by the search (today's name/email search), as checkbox rows (mockup `.people .person`). */
export const RefereePeopleSection: React.FC<RefereePeopleSectionProps> = ({
  term,
  results,
  loading,
  picked,
  assignedUserIds,
  onToggle,
}) => {
  const headingId = useId();
  const pickedIds = new Set(picked.map((person) => person.userId));

  let body: React.ReactNode;
  if (term.length < 2) {
    body = <p className="ref-sheet__note">Search by name or email</p>;
  } else if (loading) {
    body = <p className="ref-sheet__note">Searching...</p>;
  } else if (results.length === 0) {
    body = <p className="ref-sheet__note">No referees found matching "{term}"</p>;
  } else {
    body = (
      <ul className="ref-sheet__rows">
        {results.map((person) => {
          const name = personName(person);
          const assigned = assignedUserIds?.has(person.userId) ?? false;
          return (
            <li key={person.userId}>
              <Checkbox
                className="ref-row"
                checked={assigned || pickedIds.has(person.userId)}
                disabled={assigned}
                onChange={() => onToggle(person, false)}
                onKeyDown={onEnterKey(() => onToggle(person, true))}
                label={name}
              >
                <span className="ref-row__avatar" aria-hidden="true">
                  {initials(name)}
                </span>
                <span className="ref-row__who">
                  {name}
                  {person.email ? <small>{person.email}</small> : null}
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
        People
      </h3>
      {body}
    </section>
  );
};
