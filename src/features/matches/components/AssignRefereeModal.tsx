import React, { useRef, useState } from "react";
import { Match, PlayerSuggestion, RefereeTeamAssignResult, RefereeTeamOption, sideDisplayName } from "../types/match";
import { usePlayerSuggestions, useDebounce, useRefereeTeamOptions } from "../hooks";
import Drawer from "../../shared/components/Drawer";
import { Button } from "../../../ui/Button";
import { SearchInput } from "../../../ui/SearchInput";
import RefereeTeamsSection from "./RefereeTeamsSection";
import { RefereeChips, RefereePeopleSection } from "./RefereeSheetParts";
import { formatWhen } from "../utils/timeline";
import { assignButtonLabel, describeSkippedTeams } from "../../../utils/refereeAssignText";
import "./RefereeSheet.scss";

interface AssignRefereeModalProps {
  isOpen: boolean;
  match: Match | null;
  onClose: () => void;
  onAssign: (refereeIds: string[]) => Promise<void>;
  /** Resolves with the per-match outcome, or null when the request failed (the page has said why). */
  onAssignTeams: (teamIds: string[], matchIds: string[]) => Promise<RefereeTeamAssignResult[] | null>;
  onUnassignTeam: (matchId: string, teamId: string) => Promise<void>;
  loading: boolean;
  /** Takes a referee off the match at once (their chip's "-"). Without it, assigned referees are only listed. */
  onUnassignReferee?: (refereeId: string, matchId: string) => void | Promise<void>;
}

/**
 * The referee sheet for one match (mockup match-flow-v2.html phone 4): who referees it as chips, one search for people
 * (today's name/email search) and the teams allowed to referee it, ticked rows, and the Assign button. Teams go first
 * through their own request; the people then take the existing path, which refreshes the list and closes the sheet.
 */
const AssignRefereeModal: React.FC<AssignRefereeModalProps> = ({
  isOpen,
  match,
  onClose,
  onAssign,
  onAssignTeams,
  onUnassignTeam,
  loading,
  onUnassignReferee,
}) => {
  const [term, setTerm] = useState("");
  const [people, setPeople] = useState<PlayerSuggestion[]>([]);
  const [teams, setTeams] = useState<RefereeTeamOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const debouncedTerm = useDebounce(term.trim(), 300);
  const { data: suggestions = [], isLoading: suggestionsLoading } = usePlayerSuggestions(debouncedTerm);
  const {
    data: teamOptions = [],
    isLoading: teamOptionsLoading,
    isError: teamOptionsFailed,
  } = useRefereeTeamOptions(match ? [match.id] : [], isOpen && Boolean(match));

  const pickCount = teams.length + people.length;
  const busy = loading || submitting;

  // After a keyboard pick or remove, back to the search for the next name.
  const focusSearch = (fromKeyboard: boolean) => {
    if (fromKeyboard) searchRef.current?.focus();
  };

  const togglePerson = (person: PlayerSuggestion, fromKeyboard: boolean) => {
    setPeople((previous) =>
      previous.some((picked) => picked.userId === person.userId)
        ? previous.filter((picked) => picked.userId !== person.userId)
        : [...previous, person]
    );
    focusSearch(fromKeyboard);
  };

  const removePerson = (userId: string, fromKeyboard: boolean) => {
    setPeople((previous) => previous.filter((picked) => picked.userId !== userId));
    focusSearch(fromKeyboard);
  };

  const selectTeam = (team: RefereeTeamOption, fromKeyboard: boolean) => {
    setTeams((previous) => (previous.some((picked) => picked.teamId === team.teamId) ? previous : [...previous, team]));
    focusSearch(fromKeyboard);
  };

  const removeTeam = (teamId: string, fromKeyboard: boolean) => {
    setTeams((previous) => previous.filter((team) => team.teamId !== teamId));
    focusSearch(fromKeyboard);
  };

  const resetPeople = () => {
    setPeople([]);
    setTerm("");
  };

  const handleClose = () => {
    resetPeople();
    setTeams([]);
    onClose();
  };

  // Teams go first through their own request; the individuals then take the existing path,
  // which refreshes the list and closes the drawer.
  const handleAssign = async () => {
    if (!match || pickCount === 0 || submitting) return;
    const pickedTeams = teams;
    const refereeIds = people.map((person) => person.userId);
    setSubmitting(true);
    try {
      if (pickedTeams.length > 0) {
        const results = await onAssignTeams(pickedTeams.map((team) => team.teamId), [match.id]);
        if (!results) return; // The page has said why; the picks stay for another try.
        const skipped = describeSkippedTeams(
          results,
          (teamId) => pickedTeams.find((team) => team.teamId === teamId)?.teamName ?? "a team"
        );
        if (skipped) window.alert(skipped);
        setTeams([]);
      }
      if (refereeIds.length > 0) {
        await onAssign(refereeIds);
        resetPeople();
      } else {
        handleClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const assignedPeople = match?.referees ?? [];
  const context = match
    ? [
        match.venue,
        formatWhen(match.startTime),
        `${sideDisplayName(match.homeTeamName, match.homeTeam2Name)} vs ${sideDisplayName(
          match.awayTeamName,
          match.awayTeam2Name
        )}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  // Searching puts the people found first (mockup); otherwise the teams, which need no search, lead.
  const searching = term.trim() !== "";
  const peopleSection = (
    <RefereePeopleSection
      term={debouncedTerm}
      results={suggestions}
      loading={suggestionsLoading}
      picked={people}
      assignedUserIds={new Set(assignedPeople.map((referee) => referee.userId))}
      onToggle={togglePerson}
    />
  );
  const teamsSection = match ? (
    <RefereeTeamsSection
      options={teamOptions}
      loading={teamOptionsLoading}
      failed={teamOptionsFailed}
      assigned={match.refereeTeams ?? []}
      selected={teams}
      onSelect={selectTeam}
      onRemove={removeTeam}
      term={term}
      category={match.categoryName || teamOptions[0]?.categoryName}
      showCategory
      emptyText="No other team in this category can referee this match."
    />
  ) : null;

  // The drawer supplies the header, close button, Escape, backdrop click and scroll lock.
  return (
    <Drawer
      isOpen={isOpen && Boolean(match)}
      onClose={handleClose}
      title="Referees"
      subtitle={context}
      headerAction={
        <button type="button" className="drawer__link" onClick={handleClose}>
          Done
        </button>
      }
      size="md"
      className="assign-referee-drawer ref-sheet"
      footer={
        pickCount > 0 ? (
          <Button size="lg" block loading={busy} onClick={handleAssign} className="assign-button">
            {busy ? "Assigning..." : assignButtonLabel(teams.length, people.length)}
          </Button>
        ) : null
      }
    >
      {match ? (
        <>
          <RefereeChips
            assignedPeople={assignedPeople}
            assignedTeams={match.refereeTeams ?? []}
            onUnassignPerson={onUnassignReferee ? (referee) => onUnassignReferee(referee.id, match.id) : undefined}
            onUnassignTeam={(teamId) => onUnassignTeam(match.id, teamId)}
            pickedPeople={people}
            pickedTeams={teams}
            onRemovePerson={removePerson}
            onRemoveTeam={removeTeam}
            focusSearch={focusSearch}
          />
          <div className="ref-sheet__search">
            <SearchInput value={term} onChange={setTerm} placeholder="Search name, email or team" inputRef={searchRef} />
          </div>
          {searching ? (
            <>
              {peopleSection}
              {teamsSection}
            </>
          ) : (
            <>
              {teamsSection}
              {peopleSection}
            </>
          )}
        </>
      ) : null}
    </Drawer>
  );
};

export default AssignRefereeModal;
