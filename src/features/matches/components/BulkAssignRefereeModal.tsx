import React, { useState } from "react";
import { Match, PlayerSuggestion, RefereeTeamAssignResult, RefereeTeamOption } from "../types/match";
import { usePlayerSuggestions, useDebounce, useRefereeTeamOptions } from "../hooks";
import Drawer from "../../shared/components/Drawer";
import RefereeTeamsSection from "./RefereeTeamsSection";
import {
  assignButtonLabel,
  describeRefereeAssignment,
  summarizeTeamAssignment,
} from "../../../utils/refereeAssignText";
import { shouldLabelCategories } from "../../../utils/matchSheetFormat";
import "./BulkAssignRefereeModal.scss";

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

const BulkAssignRefereeModal: React.FC<BulkAssignRefereeModalProps> = ({
  isOpen,
  selectedMatches,
  onClose,
  onAssign,
  onAssignTeams,
  loading,
}) => {
  const [searchInputs, setSearchInputs] = useState<{ id: string; value: string }[]>([{ id: "1", value: "" }]);
  const [selectedRefereesData, setSelectedRefereesData] = useState<PlayerSuggestion[]>([]);
  const [activeInputId, setActiveInputId] = useState<string>("1");
  const [selectedTeams, setSelectedTeams] = useState<RefereeTeamOption[]>([]);
  const [teamOutcome, setTeamOutcome] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Get the current search term from the active input
  const currentSearchTerm = searchInputs.find((input) => input.id === activeInputId)?.value || "";
  const debouncedSearchTerm = useDebounce(currentSearchTerm, 300);

  const { data: playerSuggestions = [], isLoading: suggestionsLoading } = usePlayerSuggestions(debouncedSearchTerm);

  const matchIds = selectedMatches.map((match) => match.id);
  const {
    data: teamOptions = [],
    isLoading: teamOptionsLoading,
    isError: teamOptionsFailed,
  } = useRefereeTeamOptions(matchIds, isOpen && matchIds.length > 0);

  const pickCount = selectedTeams.length + selectedRefereesData.length;

  // A team only fits the matches of its own category, so a selection that spans categories
  // shows each team's category and how many of the matches it can take.
  const labelCategories =
    shouldLabelCategories(selectedMatches) || new Set(teamOptions.map((team) => team.categoryName)).size > 1;
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
  const teamsFitEveryMatch = selectedTeams.every((team) => eligibleCount(team) === matchIds.length);

  // A skipped match is named by its teams: the drawer lists only the first few matches, unnumbered.
  const matchName = (matchId: string) => {
    const match = selectedMatches.find((selected) => selected.id === matchId);
    return match && [match.homeTeamName, match.awayTeamName].filter(Boolean).join(" vs ");
  };

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString);
    return date.toLocaleString();
  };

  const handleInputChange = (inputId: string, value: string) => {
    setSearchInputs((prev) => prev.map((input) => (input.id === inputId ? { ...input, value } : input)));
    setActiveInputId(inputId);
  };

  const handleRefereeSelect = (referee: PlayerSuggestion) => {
    // Add referee to selected list
    setSelectedRefereesData((prev) => [...prev, referee]);

    // Clear the current input
    setSearchInputs((prev) => prev.map((input) => (input.id === activeInputId ? { ...input, value: "" } : input)));
  };

  const handleRefereeRemove = (userId: string) => {
    setSelectedRefereesData((prev) => prev.filter((ref) => ref.userId !== userId));
  };

  const handleAddRefereeInput = () => {
    const newId = Date.now().toString();
    setSearchInputs((prev) => [...prev, { id: newId, value: "" }]);
    setActiveInputId(newId);
  };

  const handleRemoveInput = (inputId: string) => {
    if (searchInputs.length > 1) {
      setSearchInputs((prev) => prev.filter((input) => input.id !== inputId));
      if (activeInputId === inputId) {
        setActiveInputId(searchInputs[0].id);
      }
    }
  };

  const handleTeamSelect = (team: RefereeTeamOption) => {
    setSelectedTeams((prev) => (prev.some((picked) => picked.teamId === team.teamId) ? prev : [...prev, team]));
  };

  const handleTeamRemove = (teamId: string) => {
    setSelectedTeams((prev) => prev.filter((team) => team.teamId !== teamId));
  };

  const resetReferees = () => {
    setSelectedRefereesData([]);
    setSearchInputs([{ id: "1", value: "" }]);
    setActiveInputId("1");
  };

  // Teams go in one request for every selected match, and the drawer stays open on the outcome, which
  // then confirms the referees picked with them. Referees alone take the existing path, which refreshes
  // the list and closes the drawer. Picks that failed stay for another try (the page has said why).
  const handleAssign = async () => {
    if (pickCount === 0 || submitting) return;
    const teams = selectedTeams;
    const refereeIds = selectedRefereesData.map((ref) => ref.userId);
    setSubmitting(true);
    setTeamOutcome(null);
    try {
      let outcome = "";
      if (teams.length > 0) {
        const results = await onAssignTeams(teams.map((team) => team.teamId), matchIds);
        if (!results) return; // The page has said why; the picks stay for another try.
        outcome = summarizeTeamAssignment(
          results,
          (teamId) => teams.find((team) => team.teamId === teamId)?.teamName ?? "A team",
          matchName
        );
        setTeamOutcome(outcome);
        setSelectedTeams([]);
      }
      if (refereeIds.length > 0 && (await onAssign(refereeIds, matchIds, teams.length > 0))) {
        if (outcome) setTeamOutcome(`${outcome} · ${describeRefereeAssignment(refereeIds.length, matchIds.length)}`);
        resetReferees();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    resetReferees();
    setSelectedTeams([]);
    setTeamOutcome(null);
    onClose();
  };

  const getUniqueVenues = () => {
    const venues = selectedMatches.map((match) => match.venue).filter(Boolean);
    return Array.from(new Set(venues));
  };

  const getUniqueTournaments = () => {
    const tournaments = selectedMatches.map((match) => match.tournamentName).filter(Boolean);
    return Array.from(new Set(tournaments));
  };

  // The drawer supplies the header, close button, Escape, backdrop click and scroll lock.
  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title="Bulk Assign Referees"
      size="md"
      className="bulk-assign-referee-drawer"
      footer={
        pickCount > 0 ? (
          <div className="assign-actions">
            <button
              className="btn-base btn-primary assign-button"
              onClick={handleAssign}
              disabled={loading || submitting}
            >
              {loading || submitting
                ? "Assigning..."
                : assignButtonLabel(
                    selectedTeams.length,
                    selectedRefereesData.length,
                    selectedMatches.length,
                    teamsFitEveryMatch
                  )}
            </button>
          </div>
        ) : null
      }
    >
      <div className="selected-matches-info">
        <h4>Selected Matches ({selectedMatches.length})</h4>
        <div className="matches-summary">
          <div className="summary-item">
            <strong>Tournaments:</strong> {getUniqueTournaments().join(", ")}
          </div>
          <div className="summary-item">
            <strong>Venues:</strong> {getUniqueVenues().join(", ")}
          </div>
        </div>

        <div className="matches-list">
          {selectedMatches.slice(0, 5).map((match) => (
            <div key={match.id} className="match-item">
              <span className="teams">
                {match.homeTeamName} vs {match.awayTeamName}
              </span>
              <span className="venue">{match.venue}</span>
              <span className="time">{match.startTime ? formatDateTime(match.startTime) : "TBD"}</span>
            </div>
          ))}
          {selectedMatches.length > 5 && (
            <div className="more-matches">... and {selectedMatches.length - 5} more matches</div>
          )}
        </div>
      </div>

      <RefereeTeamsSection
        options={teamOptions}
        loading={teamOptionsLoading}
        failed={teamOptionsFailed}
        selected={selectedTeams}
        onSelect={handleTeamSelect}
        onRemove={handleTeamRemove}
        detailFor={describeTeam}
        emptyText="No team can referee the selected matches."
        outcome={teamOutcome}
      />

      <div className="referees-section">
        {/* Selected referees to be assigned */}
        {selectedRefereesData.length > 0 && (
          <div className="selected-referees-section">
            <h4>Referees to Assign ({selectedRefereesData.length})</h4>
            <div className="selected-referees-list">
              {selectedRefereesData.map((referee) => (
                <div key={referee.userId} className="selected-referee-item">
                  <div className="referee-info">
                    <h5>
                      {referee.firstName} {referee.lastName}
                    </h5>
                    <p>{referee.email}</p>
                  </div>
                  <button
                    className="remove-button"
                    onClick={() => handleRefereeRemove(referee.userId)}
                    title="Remove referee"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search inputs */}
        <div className="search-inputs-section">
          <h4>Add Referees</h4>
          {searchInputs.map((input, index) => (
            <div key={input.id} className="search-input-row">
              <div className="input-container">
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={input.value}
                  onChange={(e) => handleInputChange(input.id, e.target.value)}
                  onFocus={() => setActiveInputId(input.id)}
                  className="referee-search-input"
                />
                {searchInputs.length > 1 && (
                  <button
                    className="remove-input-button"
                    onClick={() => handleRemoveInput(input.id)}
                    title="Remove search input"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Show suggestions only for the active input */}
              {activeInputId === input.id && (
                <div className="suggestions-container">
                  {suggestionsLoading ? (
                    <div className="loading-suggestions">
                      <p>Searching...</p>
                    </div>
                  ) : playerSuggestions.length === 0 ? (
                    debouncedSearchTerm && (
                      <div className="no-suggestions">
                        <p>No referees found matching "{debouncedSearchTerm}"</p>
                      </div>
                    )
                  ) : (
                    <div className="suggestions-list">
                      {playerSuggestions
                        .filter(
                          (referee) => !selectedRefereesData.some((selected) => selected.userId === referee.userId)
                        )
                        .map((referee) => (
                          <div
                            key={referee.id}
                            className="suggestion-item"
                            onClick={() => handleRefereeSelect(referee)}
                          >
                            <div className="referee-info">
                              <h5>
                                {referee.firstName} {referee.lastName}
                              </h5>
                              <p>{referee.email}</p>
                              <p className="nationality">
                                {referee.nationality} • {referee.gender}
                              </p>
                            </div>
                            <div className="add-icon">+</div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Add another referee button */}
          <button className="add-referee-button" onClick={handleAddRefereeInput}>
            + Add Another Referee
          </button>
        </div>
      </div>
    </Drawer>
  );
};

export default BulkAssignRefereeModal;
