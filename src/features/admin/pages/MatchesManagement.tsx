import React, { useState, useEffect, useCallback } from "react";
import {
  getAllMatchesForAdmin,
  getAllRefereesForAdmin,
  assignRefereeToMatch,
  bulkAssignRefereeToMatches,
  unassignRefereeFromMatch,
  updateKnockoutMatch,
  updateLeagueMatch,
  updateGroupMatch,
} from "../api";
import { Match, Referee, MatchGameScore, MatchFilters, AdminMatchesResponse } from "../../matches/api/matches";
import MatchCard from "../../shared/components/MatchCard";
import AssignRefereeModal from "../components/AssignRefereeModal";
import BulkAssignRefereeModal from "../components/BulkAssignRefereeModal";
import UpdateScoreDialog from "../components/UpdateScoreDialog";
import BulkUpdateScoreModal from "../components/BulkUpdateScoreModal";
import "./MatchesManagement.scss";

interface FilterOptions {
  tournaments: string[];
  categories: string[];
  formats: string[];
  rounds: string[];
  venues: string[];
}

const MatchesManagement: React.FC = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [referees, setReferees] = useState<Referee[]>([]);
  const [totalMatches, setTotalMatches] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assigningReferee, setAssigningReferee] = useState(false);
  const [showUpdateScoreModal, setShowUpdateScoreModal] = useState(false);
  const [updatingScore, setUpdatingScore] = useState(false);
  const [selectedMatchForScore, setSelectedMatchForScore] = useState<Match | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTournament, setFilterTournament] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterFormat, setFilterFormat] = useState<string>("all");
  const [filterRound, setFilterRound] = useState<string>("all");
  const [filterVenue, setFilterVenue] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [showBulkAssignmentModal, setShowBulkAssignmentModal] = useState(false);
  const [bulkAssigningReferee, setBulkAssigningReferee] = useState(false);
  const [showBulkUpdateScoreModal, setShowBulkUpdateScoreModal] = useState(false);
  const [bulkUpdatingScores, setBulkUpdatingScores] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(30);
  const [totalPages, setTotalPages] = useState<number>(0);

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

  // URL params sync state
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize filters from URL params on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);

    // Load filters from URL params
    const urlSearchTerm = urlParams.get("search") || "";
    const urlStatus = urlParams.get("status") || "all";
    const urlTournament = urlParams.get("tournament") || "all";
    const urlCategory = urlParams.get("category") || "all";
    const urlFormat = urlParams.get("format") || "all";
    const urlRound = urlParams.get("round") || "all";
    const urlVenue = urlParams.get("venue") || "all";
    const urlPage = parseInt(urlParams.get("page") || "1", 10);
    const urlPageSize = parseInt(urlParams.get("pageSize") || "30", 10);

    // Set state from URL params
    setSearchTerm(urlSearchTerm);
    setFilterStatus(urlStatus);
    setFilterTournament(urlTournament);
    setFilterCategory(urlCategory);
    setFilterFormat(urlFormat);
    setFilterRound(urlRound);
    setFilterVenue(urlVenue);
    setCurrentPage(urlPage);
    setPageSize(urlPageSize);

    setIsInitialized(true);
  }, []);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Update URL params when filters or pagination change
  useEffect(() => {
    if (!isInitialized) return;

    const urlParams = new URLSearchParams();

    // Add filters to URL params
    if (searchTerm) urlParams.set("search", searchTerm);
    if (filterStatus !== "all") urlParams.set("status", filterStatus);
    if (filterTournament !== "all") urlParams.set("tournament", filterTournament);
    if (filterCategory !== "all") urlParams.set("category", filterCategory);
    if (filterFormat !== "all") urlParams.set("format", filterFormat);
    if (filterRound !== "all") urlParams.set("round", filterRound);
    if (filterVenue !== "all") urlParams.set("venue", filterVenue);

    // Add pagination to URL params
    if (currentPage > 1) urlParams.set("page", currentPage.toString());
    if (pageSize !== 30) urlParams.set("pageSize", pageSize.toString());

    // Update URL without reloading the page
    const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""}`;
    window.history.replaceState({}, "", newUrl);
  }, [
    isInitialized,
    searchTerm,
    filterStatus,
    filterTournament,
    filterCategory,
    filterFormat,
    filterRound,
    filterVenue,
    currentPage,
    pageSize,
  ]);

  // Initial load when component is initialized
  useEffect(() => {
    if (!isInitialized) return;

    const initialFilters: MatchFilters = {
      search: searchTerm || undefined,
      status: filterStatus !== "all" ? (filterStatus as "completed" | "in-progress" | "upcoming") : undefined,
      tournament: filterTournament !== "all" ? filterTournament : undefined,
      category: filterCategory !== "all" ? filterCategory : undefined,
      format: filterFormat !== "all" ? filterFormat : undefined,
      round: filterRound !== "all" ? filterRound : undefined,
      venue: filterVenue !== "all" ? filterVenue : undefined,
      pageSize: pageSize,
      pageNumber: currentPage,
    };

    fetchData(initialFilters);
  }, [isInitialized]);

  // Apply filters when they change (using debounced search term)
  useEffect(() => {
    if (!isInitialized) return;

    const filters: MatchFilters = {
      search: debouncedSearchTerm || undefined,
      status: filterStatus !== "all" ? (filterStatus as "completed" | "in-progress" | "upcoming") : undefined,
      tournament: filterTournament !== "all" ? filterTournament : undefined,
      category: filterCategory !== "all" ? filterCategory : undefined,
      format: filterFormat !== "all" ? filterFormat : undefined,
      round: filterRound !== "all" ? filterRound : undefined,
      venue: filterVenue !== "all" ? filterVenue : undefined,
      pageSize: pageSize,
      pageNumber: currentPage,
    };

    fetchData(filters);
  }, [
    debouncedSearchTerm,
    filterStatus,
    filterTournament,
    filterCategory,
    filterFormat,
    filterRound,
    filterVenue,
    currentPage,
    pageSize,
  ]);

  // Reset to first page when filters change
  useEffect(() => {
    if (!isInitialized) return;
    setCurrentPage(1);
  }, [isInitialized, filterStatus, filterTournament, filterCategory, filterFormat, filterRound, filterVenue]);

  // Reset round filter when format changes to avoid invalid selections
  useEffect(() => {
    if (!isInitialized) return;
    setFilterRound("all");
  }, [isInitialized, filterFormat]);

  // Reset category filter when tournament changes
  useEffect(() => {
    if (!isInitialized) return;
    setFilterCategory("all");
  }, [isInitialized, filterTournament]);

  // Reset format filter when tournament or category changes
  useEffect(() => {
    if (!isInitialized) return;
    setFilterFormat("all");
  }, [isInitialized, filterTournament, filterCategory]);

  // Reset venue filter when tournament or category changes
  useEffect(() => {
    if (!isInitialized) return;
    setFilterVenue("all");
  }, [isInitialized, filterTournament, filterCategory]);

  const fetchData = useCallback(async (filters?: MatchFilters) => {
    try {
      setLoading(true);
      const [matchesResponse, refereesResponse] = await Promise.all([
        getAllMatchesForAdmin(filters),
        getAllRefereesForAdmin(),
      ]);

      // Extract data from new response structure
      const allMatches: Match[] = matchesResponse.data.data.matches.items || [];
      const allReferees: Referee[] = refereesResponse.data?.data || [];
      const totalCount: number = matchesResponse.data.data.matches.pagination.total || 0;
      const totalPagesCount: number = matchesResponse.data.data.matches.pagination.totalPages || 1;

      // Extract match status counts from response
      const inProgressCount: number = matchesResponse.data.data.inProgressCount || 0;
      const incomingCount: number = matchesResponse.data.data.incomingCount || 0;
      const completedCount: number = matchesResponse.data.data.completedCount || 0;

      // Extract filter options from response (if available)
      const apiFilterOptions: FilterOptions = matchesResponse.data.data.filters || {
        tournaments: [],
        categories: [],
        formats: [],
        rounds: [],
        venues: [],
      };

      setMatches(allMatches);
      setReferees(allReferees);
      setTotalMatches(totalCount);
      setTotalPages(totalPagesCount);
      setInProgressCount(inProgressCount);
      setIncomingCount(incomingCount);
      setCompletedCount(completedCount);
      setFilterOptions(apiFilterOptions);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      setError("An error occurred while loading data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const getMatchStatus = (match: Match) => {
    if (match.isCompleted) {
      return "completed";
    }
    if (match.startTime && new Date(match.startTime) < new Date()) {
      return "in-progress";
    }
    return "upcoming";
  };

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

    // If format filter is set to "knockout", only show knockout-specific rounds
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

  const handleAssignReferee = async (refereeId: string) => {
    if (!selectedMatch) return;

    try {
      setAssigningReferee(true);
      await assignRefereeToMatch(refereeId, selectedMatch.id);

      // Refresh data to show updated assignments
      await fetchData();
      setShowAssignmentModal(false);
      setSelectedMatch(null);
    } catch (error: any) {
      console.error("Error assigning referee:", error);
      alert("Failed to assign referee. Please try again.");
    } finally {
      setAssigningReferee(false);
    }
  };

  const handleBulkAssignReferee = async (refereeId: string, matchIds: string[]) => {
    try {
      setBulkAssigningReferee(true);
      await bulkAssignRefereeToMatches(refereeId, matchIds);

      // Refresh data to show updated assignments
      await fetchData();
      setShowBulkAssignmentModal(false);
      setSelectedMatches(new Set());
    } catch (error: any) {
      console.error("Error bulk assigning referee:", error);
      const errorMessage = error.message || "Failed to assign referee to one or more matches. Please try again.";
      alert(errorMessage);
    } finally {
      setBulkAssigningReferee(false);
    }
  };

  const handleBulkUpdateScores = async (matchScores: { matchId: string; gameScores: MatchGameScore[] }[]) => {
    try {
      setBulkUpdatingScores(true);

      // Update each match with its scores
      const updatePromises = matchScores.map(async ({ matchId, gameScores }) => {
        const match = matches?.find((m) => m.id === matchId);
        if (!match) return;

        if (match.format === "Group") {
          return updateGroupMatch(matchId, { gameScores });
        } else if (match.format === "League") {
          return updateLeagueMatch(matchId, { gameScores });
        } else if (match.format === "Knockout") {
          return updateKnockoutMatch(matchId, { gameScores });
        }
      });

      await Promise.all(updatePromises);

      // Refresh data to show updated scores
      await fetchData();
      setShowBulkUpdateScoreModal(false);
      setSelectedMatches(new Set());
    } catch (error: any) {
      console.error("Error bulk updating scores:", error);
      alert("Failed to update scores for one or more matches. Please try again.");
    } finally {
      setBulkUpdatingScores(false);
    }
  };

  const handleUnassignReferee = async (refereeId: string, matchId: string) => {
    try {
      await unassignRefereeFromMatch(refereeId, matchId);
      await fetchData();
    } catch (error: any) {
      console.error("Error unassigning referee:", error);
      alert("Failed to unassign referee. Please try again.");
    }
  };

  const openAssignmentModal = (match: Match) => {
    setSelectedMatch(match);
    setShowAssignmentModal(true);
  };

  const handleUpdateScore = (match: Match) => {
    setSelectedMatchForScore(match);
    setShowUpdateScoreModal(true);
  };

  const handleSubmitScore = async (gameScores: MatchGameScore[]) => {
    if (!selectedMatchForScore) return;

    try {
      setUpdatingScore(true);

      // Call API to update match scores
      if (selectedMatchForScore.format === "Group") {
        await updateGroupMatch(selectedMatchForScore.id, { gameScores });
      } else if (selectedMatchForScore.format === "League") {
        await updateLeagueMatch(selectedMatchForScore.id, { gameScores });
      } else if (selectedMatchForScore.format === "Knockout") {
        await updateKnockoutMatch(selectedMatchForScore.id, { gameScores });
      }

      // Refresh data to show updated scores
      await fetchData();
      setShowUpdateScoreModal(false);
      setSelectedMatchForScore(null);
    } catch (error: any) {
      console.error("Error updating scores:", error);
      alert("Failed to update scores. Please try again.");
    } finally {
      setUpdatingScore(false);
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

  const handleMatchSelection = (matchId: string, selected: boolean) => {
    const newSelectedMatches = new Set(selectedMatches);
    if (selected) {
      newSelectedMatches.add(matchId);
    } else {
      newSelectedMatches.delete(matchId);
    }
    setSelectedMatches(newSelectedMatches);
  };

  const clearSelectedMatches = () => {
    setSelectedMatches(new Set());
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  // Generate pagination page numbers
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show pages around current page
      let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
      let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

      // Adjust if we're near the end
      if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }

    return pages;
  };

  if (loading) {
    return (
      <div className="matches-management">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading matches...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="matches-management">
        <div className="error-container">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => fetchData()} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const pageNumbers = getPageNumbers();

  return (
    <div className="matches-management">
      <div className="dashboard-header">
        <h1>Matches Management</h1>
        <p>Manage all matches and referee assignments</p>
      </div>

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

      {/* Bulk Assignment Controls */}
      <div className="bulk-assignment-controls">
        <div className="bulk-info">
          {selectedMatches.size > 0 ? (
            <>
              <span className="selected-count">
                {selectedMatches.size} match{selectedMatches.size !== 1 ? "es" : ""} selected
              </span>
              <button className="clear-selection-btn" onClick={clearSelectedMatches}>
                Clear Selection
              </button>
            </>
          ) : (
            <>
              <span className="selection-prompt">Select matches to bulk assign referee or update scores</span>
              <button
                className="select-all-btn"
                onClick={() => {
                  const allMatchIds = new Set(matches?.map((match) => match.id) || []);
                  setSelectedMatches(allMatchIds);
                }}
              >
                Select All ({matches.length})
              </button>
            </>
          )}
        </div>
        {selectedMatches.size > 0 && (
          <div className="bulk-actions">
            <button className="bulk-assign-btn" onClick={() => setShowBulkAssignmentModal(true)}>
              Bulk Assign Referee
            </button>
            <button className="bulk-update-score-btn" onClick={() => setShowBulkUpdateScoreModal(true)}>
              Bulk Update Scores
            </button>
          </div>
        )}
      </div>

      <div className="matches-stats">
        <div className="matches-count">
          <span className="stat-label">Total Matches</span>
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
                : "There are no matches available to manage."}
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
        <>
          <div className="matches-grid">
            {matches
              ?.sort((a, b) => new Date(b.startTime || "").getTime() - new Date(a.startTime || "").getTime())
              ?.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  onUpdateScore={handleUpdateScore}
                  onAssignReferee={openAssignmentModal}
                  onUnassignReferee={handleUnassignReferee}
                  showAdminActions={true}
                  showUpdateScore={true}
                  isSelectable={true}
                  isSelected={selectedMatches.has(match.id)}
                  onSelectionChange={handleMatchSelection}
                />
              ))}
          </div>

          {/* Pagination Controls */}
          <div className="pagination-container">
            <div className="pagination-info">
              <span>
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalMatches)} of{" "}
                {totalMatches} matches
              </span>
              <div className="page-size-selector">
                <label htmlFor="page-size">Show:</label>
                <select
                  id="page-size"
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="page-size-select"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>per page</span>
              </div>
            </div>

            <div className="pagination-controls">
              <button className="pagination-btn" onClick={() => handlePageChange(1)} disabled={currentPage === 1}>
                First
              </button>
              <button
                className="pagination-btn"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </button>

              {pageNumbers.map((page) => (
                <button
                  key={page}
                  className={`pagination-btn ${page === currentPage ? "active" : ""}`}
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </button>
              ))}

              <button
                className="pagination-btn"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
              <button
                className="pagination-btn"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
              >
                Last
              </button>
            </div>
          </div>
        </>
      )}

      {/* Assignment Modal */}
      <AssignRefereeModal
        isOpen={showAssignmentModal}
        match={selectedMatch}
        referees={referees}
        onClose={() => setShowAssignmentModal(false)}
        onAssign={handleAssignReferee}
        loading={assigningReferee}
      />

      {/* Bulk Assignment Modal */}
      <BulkAssignRefereeModal
        isOpen={showBulkAssignmentModal}
        selectedMatches={matches?.filter((match) => selectedMatches.has(match.id)) || []}
        referees={referees}
        onClose={() => setShowBulkAssignmentModal(false)}
        onAssign={handleBulkAssignReferee}
        loading={bulkAssigningReferee}
      />

      {/* Update Score Modal */}
      <UpdateScoreDialog
        isOpen={showUpdateScoreModal}
        match={selectedMatchForScore}
        onClose={() => {
          setShowUpdateScoreModal(false);
          setSelectedMatchForScore(null);
        }}
        onSubmit={handleSubmitScore}
        loading={updatingScore}
      />

      {/* Bulk Update Score Modal */}
      <BulkUpdateScoreModal
        isOpen={showBulkUpdateScoreModal}
        selectedMatches={matches?.filter((match) => selectedMatches.has(match.id)) || []}
        onClose={() => setShowBulkUpdateScoreModal(false)}
        onSubmit={handleBulkUpdateScores}
        loading={bulkUpdatingScores}
      />
    </div>
  );
};

export default MatchesManagement;
