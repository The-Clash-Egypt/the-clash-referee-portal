import React, { useRef, useState } from "react";
import { Match, PlayerSuggestion, RefereeTeamAssignResult, RefereeTeamOption } from "../types/match";
import { usePlayerSuggestions, useDebounce, useRefereeTeamOptions } from "../hooks";
import Drawer from "../../shared/components/Drawer";
import { Button } from "../../../ui/Button";
import { SearchInput } from "../../../ui/SearchInput";
import RefereeTeamsSection from "./RefereeTeamsSection";
import { RefereeChips, RefereePeopleSection } from "./RefereeSheetParts";
import {
  assignButtonLabel,
  describeRefereeAssignment,
  summarizeTeamAssignment,
} from "../../../utils/refereeAssignText";
import { shouldLabelCategories } from "../../../utils/matchSheetFormat";
import "./RefereeSheet.scss";

interface BulkAssignRefereeModalProps {
  isOpen: boolean;
  selectedMatches: Match[];
  onClose: () => void;
  /**
   * `keepOpen` asks the page not to close the drawer, so a team outcome stays readable.
   * Resolves true once the referees are assigned, false when they weren't (the page has said why).
   */
  onAssign: (refereeIds: string[], matchIds: string[], keepOpen?: boolean) => Promise<boolean>;
  /** Resolves with the per-match outcome, or null when the request failed (the page has said why). */
  onAssignTeams: (teamIds: string[], matchIds: string[]) => Promise<RefereeTeamAssignResult[] | null>;
  loading: boolean;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * The referee sheet for the matches picked in select mode (mockup match-flow-v2.html phone 4, "same sheet for one
 * match or many"): one search for people and for the teams allowed to referee them, ticked rows, the Assign button.
 * Teams go in one request for every match and the sheet stays open on the outcome (who was skipped and why).
 */
const BulkAssignRefereeModal: React.FC<BulkAssignRefereeModalProps> = ({
  isOpen,
  selectedMatches,
  onClose,
  onAssign,
  onAssignTeams,
  loading,
}) => {
  const [term, setTerm] = useState("");
  const [people, setPeople] = useState<PlayerSuggestion[]>([]);
  const [teams, setTeams] = useState<RefereeTeamOption[]>([]);
  const [teamOutcome, setTeamOutcome] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const debouncedTerm = useDebounce(term.trim(), 300);
  const { data: suggestions = [], isLoading: suggestionsLoading } = usePlayerSuggestions(debouncedTerm);

  const matchIds = selectedMatches.map((match) => match.id);
  const {
    data: teamOptions = [],
    isLoading: teamOptionsLoading,
    isError: teamOptionsFailed,
  } = useRefereeTeamOptions(matchIds, isOpen && matchIds.length > 0);

  const pickCount = teams.length + people.length;
  const busy = loading || submitting;

  // A team only fits the matches of its own category, so a selection that spans categories
  // shows each team's category and how many of the matches it can take.
  const categories = Array.from(new Set(teamOptions.map((team) => team.categoryName)));
  const labelCategories = shouldLabelCategories(selectedMatches) || categories.length > 1;
  const eligibleCount = (team: RefereeTeamOption) => team.eligibleMatchIds.filter((id) => matchIds.includes(id)).length;
  const describeTeam = (team: RefereeTeamOption): string => {
    const eligible = eligibleCount(team);
    return [
      labelCategories ? team.categoryName : "",
      eligible < matchIds.length ? `eligible for ${eligible} of ${matchIds.length} matches` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  };

  // The footer promises every match to the teams only when each picked team can take them all.
  const teamsFitEveryMatch = teams.every((team) => eligibleCount(team) === matchIds.length);

  // A skipped match is named by its teams: the sheet doesn't list the matches.
  const matchName = (matchId: string) => {
    const match = selectedMatches.find((selected) => selected.id === matchId);
    return match && [match.homeTeamName, match.awayTeamName].filter(Boolean).join(" vs ");
  };

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

  // Teams go in one request for every selected match, and the drawer stays open on the outcome, which
  // then confirms the referees picked with them. Referees alone take the existing path, which refreshes
  // the list and closes the drawer. Picks that failed stay for another try (the page has said why).
  const handleAssign = async () => {
    if (pickCount === 0 || submitting) return;
    const pickedTeams = teams;
    const refereeIds = people.map((person) => person.userId);
    setSubmitting(true);
    setTeamOutcome(null);
    try {
      let outcome = "";
      if (pickedTeams.length > 0) {
        const results = await onAssignTeams(pickedTeams.map((team) => team.teamId), matchIds);
        if (!results) return; // The page has said why; the picks stay for another try.
        outcome = summarizeTeamAssignment(
          results,
          (teamId) => pickedTeams.find((team) => team.teamId === teamId)?.teamName ?? "A team",
          matchName
        );
        setTeamOutcome(outcome);
        setTeams([]);
      }
      if (refereeIds.length > 0 && (await onAssign(refereeIds, matchIds, pickedTeams.length > 0))) {
        if (outcome) setTeamOutcome(`${outcome} · ${describeRefereeAssignment(refereeIds.length, matchIds.length)}`);
        resetPeople();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    resetPeople();
    setTeams([]);
    setTeamOutcome(null);
    onClose();
  };

  const courts = Array.from(new Set(selectedMatches.map((match) => match.venue).filter(Boolean)));

  // Searching puts the people found first (mockup); otherwise the teams, which need no search, lead.
  const searching = term.trim() !== "";
  const peopleSection = (
    <RefereePeopleSection
      term={debouncedTerm}
      results={suggestions}
      loading={suggestionsLoading}
      picked={people}
      onToggle={togglePerson}
    />
  );
  const teamsSection = (
    <RefereeTeamsSection
      options={teamOptions}
      loading={teamOptionsLoading}
      failed={teamOptionsFailed}
      selected={teams}
      onSelect={selectTeam}
      onRemove={removeTeam}
      term={term}
      category={categories.length === 1 && !labelCategories ? categories[0] : undefined}
      detailFor={describeTeam}
      emptyText="No team can referee the selected matches."
    />
  );

  // The drawer supplies the header, close button, Escape, backdrop click and scroll lock.
  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title={`Referees · ${plural(selectedMatches.length, "match", "matches")}`}
      subtitle={courts.length > 0 ? courts.join(" · ") : undefined}
      headerAction={
        // With picks waiting, Done saves them (as the footer button does) rather than dropping them unsaved.
        <button
          type="button"
          className="drawer__link"
          onClick={pickCount > 0 ? handleAssign : handleClose}
          disabled={busy}
        >
          Done
        </button>
      }
      size="md"
      className="bulk-assign-referee-drawer ref-sheet"
      footer={
        pickCount > 0 ? (
          <Button size="lg" block loading={busy} onClick={handleAssign} className="assign-button">
            {busy
              ? "Assigning..."
              : assignButtonLabel(teams.length, people.length, selectedMatches.length, teamsFitEveryMatch)}
          </Button>
        ) : null
      }
    >
      <RefereeChips
        pickedPeople={people}
        pickedTeams={teams}
        onRemovePerson={removePerson}
        onRemoveTeam={removeTeam}
        teamDetail={describeTeam}
        focusSearch={focusSearch}
      />
      {/* Mounted while empty, so the outcome is announced when it arrives. */}
      <div role="status">{teamOutcome ? <p className="ref-sheet__outcome">{teamOutcome}</p> : null}</div>
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
    </Drawer>
  );
};

export default BulkAssignRefereeModal;
