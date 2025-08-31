import React, { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import {
  getRefereeMatches,
  Match,
  MatchGameScore,
  updateGroupMatch,
  updateLeagueMatch,
  updateKnockoutMatch,
  MatchFilters,
} from "../api/matches";
import { RootState } from "../../../store";
import MatchCard from "../../shared/components/MatchCard";
import UpdateScoreDialog from "../../admin/components/UpdateScoreDialog";
import "./MatchesDashboard.scss";

interface FilterOptions {
  tournaments: string[];
  categories: string[];
  formats: string[];
  rounds: string[];
  venues: string[];
}

const MatchesDashboard: React.FC = () => {
  const user = useSelector((state: RootState) => state.user.user);
  const [matches, setMatches] = useState<Match[]>([]);
  const [totalMatches, setTotalMatches] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTournament, setFilterTournament] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterFormat, setFilterFormat] = useState<string>("all");
  const [filterRound, setFilterRound] = useState<string>("all");
  const [filterVenue, setFilterVenue] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [updateScoreDialog, setUpdateScoreDialog] = useState<{
    isOpen: boolean;
    match: Match | null;
  }>({
    isOpen: false,
    match: null,
  });
  const [updateScoreLoading, setUpdateScoreLoading] = useState(false);

  // Match status counts from API
  const [inProgressCount, setInProgressCount] = useState<number>(0);
  const [incomingCount, setIncomingCount] = useState<number>(0);
  const [completedCount, setCompletedCount] = useState<number>(0);

  // Filter options from API
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    tournaments: [],
    categories: [],
    formats: [],
    rounds: [],
    venues: [],
  });

  useEffect(() => {
    fetchMatches();
  }, []);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Apply filters when they change (using debounced search term)
  useEffect(() => {
    const filters: MatchFilters = {
      search: debouncedSearchTerm || undefined,
      status: filterStatus !== "all" ? (filterStatus as "completed" | "in-progress" | "upcoming") : undefined,
      tournament: filterTournament !== "all" ? filterTournament : undefined,
      category: filterCategory !== "all" ? filterCategory : undefined,
      format: filterFormat !== "all" ? filterFormat : undefined,
      round: filterRound !== "all" ? filterRound : undefined,
      venue: filterVenue !== "all" ? filterVenue : undefined,
    };

    fetchMatches(filters);
  }, [debouncedSearchTerm, filterStatus, filterTournament, filterCategory, filterFormat, filterRound, filterVenue]);

  // Reset round filter when format changes
  useEffect(() => {
    setFilterRound("all");
  }, [filterFormat]);

  // Reset category filter when tournament changes
  useEffect(() => {
    setFilterCategory("all");
  }, [filterTournament]);

  // Reset format filter when tournament or category changes
  useEffect(() => {
    setFilterFormat("all");
  }, [filterTournament, filterCategory]);

  // Reset venue filter when tournament or category changes
  useEffect(() => {
    setFilterVenue("all");
  }, [filterTournament, filterCategory]);

  const fetchMatches = useCallback(async (filters?: MatchFilters) => {
    try {
      setLoading(true);
      const response = await getRefereeMatches(filters);

      // Extract data from new response structure
      const allMatches: Match[] = response.data.data.matches.items || [];
      const totalCount: number = response.data.data.matches.pagination.total || 0;

      // Extract match status counts from response
      const inProgressCount: number = response.data.data.inProgressCount || 0;
      const incomingCount: number = response.data.data.incomingCount || 0;
      const completedCount: number = response.data.data.completedCount || 0;

      // Extract filter options from matches data
      const apiFilterOptions: FilterOptions = response.data.data.filters || {
        tournaments: response.data.data.filters
          ? (Array.from(new Set(allMatches.map((match) => match.tournamentName).filter(Boolean))) as string[])
          : [],
        categories: response.data.data.filters
          ? (Array.from(new Set(allMatches.map((match) => match.categoryName).filter(Boolean))) as string[])
          : [],
        formats: response.data.data.filters
          ? (Array.from(new Set(allMatches.map((match) => match.format).filter(Boolean))) as string[])
          : [],
        rounds: response.data.data.filters
          ? (Array.from(new Set(allMatches.map((match) => match.round).filter(Boolean))) as string[])
          : [],
        venues: response.data.data.filters
          ? (Array.from(new Set(allMatches.map((match) => match.venue).filter(Boolean))) as string[])
          : [],
      };

      setMatches(allMatches);
      setTotalMatches(totalCount);
      setInProgressCount(inProgressCount);
      setIncomingCount(incomingCount);
      setCompletedCount(completedCount);
      setFilterOptions(apiFilterOptions);
    } catch (error: any) {
      console.error("Error fetching matches:", error);
      setError("An error occurred while loading matches");
    } finally {
      setLoading(false);
    }
  }, []);

  // Get filtered rounds based on selected format
  const getFilteredRounds = () => {
    const allRounds = filterOptions.rounds || [];

    const knockoutRounds = [
      "Round of 128",
      "Round of 64",
      "Round of 32",
      "Round of 16",
      "Quarterfinals",
      "Semifinals",
      "Final",
      "Third place",
    ];

    if (filterFormat === "Knockout") {
      return allRounds
        .filter((round) =>
          knockoutRounds.some((knockoutRound) => round.toLowerCase().includes(knockoutRound.toLowerCase()))
        )
        .sort((a, b) => knockoutRounds.indexOf(a) - knockoutRounds.indexOf(b));
    } else {
      return allRounds
        .filter(
          (round) => !knockoutRounds.some((knockoutRound) => round.toLowerCase().includes(knockoutRound.toLowerCase()))
        )
        .sort((a, b) => a.localeCompare(b));
    }
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
    setFilterTournament("all");
    setFilterCategory("all");
    setFilterFormat("all");
    setFilterRound("all");
    setFilterVenue("all");
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const handleUpdateScore = (match: Match) => {
    setUpdateScoreDialog({
      isOpen: true,
      match: match,
    });
  };

  const handleCloseUpdateScoreDialog = () => {
    setUpdateScoreDialog({
      isOpen: false,
      match: null,
    });
  };

  const handleSubmitUpdateScore = async (gameScores: MatchGameScore[]) => {
    if (!updateScoreDialog.match) return;

    try {
      setUpdateScoreLoading(true);
      if (updateScoreDialog.match.format === "Group") {
        await updateGroupMatch(updateScoreDialog.match.id, { gameScores });
      } else if (updateScoreDialog.match.format === "League") {
        await updateLeagueMatch(updateScoreDialog.match.id, { gameScores });
      } else if (updateScoreDialog.match.format === "Knockout") {
        await updateKnockoutMatch(updateScoreDialog.match.id, { gameScores });
      }

      // Refresh matches to show updated scores
      await fetchMatches();

      // Show success message (you can add a toast notification here)
      console.log("Score updated successfully");
    } catch (error: any) {
      console.error("Error updating score:", error);
      // Show error message (you can add a toast notification here)
      throw error; // Re-throw to let the dialog handle the error
    } finally {
      setUpdateScoreLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="matches-dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading matches...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="matches-dashboard">
        <div className="error-container">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => fetchMatches()} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="matches-dashboard">
      <div className="dashboard-header">
        <h1>Matches</h1>
        <p>View and manage your assigned matches</p>
      </div>

      {matches.length > 0 && (
        <div className="filters-section">
          <div className="search-filter">
            <input
              type="text"
              placeholder="Search matches by team, venue, or tournament..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <button className={`filters-toggle ${showFilters ? "expanded" : ""}`} onClick={toggleFilters}>
            <span>Filters & Search</span>
            <span className="toggle-icon">▼</span>
          </button>

          <div className={`filters-row ${showFilters ? "visible" : ""}`}>
            <div className="filter-group">
              <select
                value={filterTournament}
                onChange={(e) => setFilterTournament(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Tournaments</option>
                {filterOptions.tournaments?.map((tournament) => (
                  <option key={tournament} value={tournament}>
                    {tournament}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Categories</option>
                {filterOptions.categories?.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <select value={filterFormat} onChange={(e) => setFilterFormat(e.target.value)} className="filter-select">
                <option value="all">All Formats</option>
                {filterOptions.formats?.map((format) => (
                  <option key={format} value={format}>
                    {format}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <select value={filterRound} onChange={(e) => setFilterRound(e.target.value)} className="filter-select">
                <option value="all">All Rounds</option>
                {getFilteredRounds().map((round) => (
                  <option key={round} value={round}>
                    {round}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <select value={filterVenue} onChange={(e) => setFilterVenue(e.target.value)} className="filter-select">
                <option value="all">All Venues</option>
                {filterOptions.venues?.map((venue) => (
                  <option key={venue} value={venue}>
                    {venue}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
                <option value="all">All Status</option>
                <option value="upcoming">Upcoming</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="filter-group">
              <button onClick={clearAllFilters} className="clear-filters-btn">
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="matches-stats">
        <div className="matches-count">
          <span className="stat-label">Total Assigned Matches</span>
          <span className="stat-value">{totalMatches}</span>
          {matches.length > 0 && matches.length !== totalMatches && (
            <span className="current-page-info">(Showing {matches.length} on this page)</span>
          )}
        </div>
        <div className="status-stats">
          <div className="stat-item">
            <span className="stat-label">Upcoming</span>
            <span className="stat-value">{incomingCount}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">In Progress</span>
            <span className="stat-value">{inProgressCount}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Completed</span>
            <span className="stat-value">{completedCount}</span>
          </div>
        </div>
      </div>

      {!matches || matches.length === 0 ? (
        <div className="no-matches">
          <div className="empty-state">
            <h2>No Matches Found</h2>
            <p>
              {searchTerm ||
              filterStatus !== "all" ||
              filterTournament !== "all" ||
              filterCategory !== "all" ||
              filterFormat !== "all" ||
              filterRound !== "all" ||
              filterVenue !== "all"
                ? "No matches match your current filters. Try adjusting your search or filters."
                : "You don't have any matches assigned yet."}
            </p>
            {(searchTerm ||
              filterStatus !== "all" ||
              filterTournament !== "all" ||
              filterCategory !== "all" ||
              filterFormat !== "all" ||
              filterRound !== "all" ||
              filterVenue !== "all") && (
              <button onClick={clearAllFilters} className="btn btn-primary">
                Clear All Filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="matches-grid">
          {matches
            ?.sort((a, b) => new Date(b.startTime || "").getTime() - new Date(a.startTime || "").getTime())
            ?.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                onUpdateScore={handleUpdateScore}
                showAdminActions={false}
                showAssignReferee={false}
                showUpdateScore={!match.isCompleted}
              />
            ))}
        </div>
      )}

      {/* Update Score Dialog */}
      <UpdateScoreDialog
        isOpen={updateScoreDialog.isOpen}
        match={updateScoreDialog.match}
        onClose={handleCloseUpdateScoreDialog}
        onSubmit={handleSubmitUpdateScore}
        loading={updateScoreLoading}
      />
    </div>
  );
};

export default MatchesDashboard;
