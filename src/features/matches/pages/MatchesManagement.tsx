import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  assignRefereeToMatch,
  bulkAssignRefereeToMatches,
  unassignRefereeFromMatch,
  updateKnockoutMatch,
  updateLeagueMatch,
  updateGroupMatch,
  getRefereeMatches,
} from "../api/matches";
import MatchCard from "../../shared/components/MatchCard";
import AssignRefereeModal from "../components/AssignRefereeModal";
import BulkAssignRefereeModal from "../components/BulkAssignRefereeModal";
import UpdateScoreDialog from "../components/UpdateScoreDialog";
import BulkUpdateScoreModal from "../components/BulkUpdateScoreModal";
import VolleyballLoading from "../../../components/VolleyballLoading";
import { useParams, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../../../store";
import { Match, MatchGameScore, MatchFilters } from "../types/match";
import "./MatchesManagement.scss";

interface FilterOptions {
  tournaments: string[];
  categories: string[];
  formats: string[];
  rounds: string[];
  venues: string[];
}

const MatchesManagement: React.FC = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const tournamentName = searchParams.get("name");
  const user = useSelector((state: RootState) => state.user.user);

  const [matches, setMatches] = useState<Match[]>([]);
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

  // Refs to track if filters are being restored from URL vs changed by user
  const isRestoringFromURL = useRef(false);
  const previousFilters = useRef({
    category: "all",
    format: "all",
    round: "all",
    venue: "all",
  });

  const isAdmin = user?.role === "admin";

  // Initialize filters from URL params on component mount
  useEffect(() => {
    isRestoringFromURL.current = true;

    const urlParams = new URLSearchParams(window.location.search);

    // Load filters from URL params
    const urlSearchTerm = urlParams.get("search") || "";
    const urlStatus = urlParams.get("status") || "all";
    const urlCategory = urlParams.get("category") || "all";
    const urlFormat = urlParams.get("format") || "all";
    const urlRound = urlParams.get("round") || "all";
    const urlVenue = urlParams.get("venue") || "all";
    const urlPage = parseInt(urlParams.get("page") || "1", 10);
    const urlPageSize = parseInt(urlParams.get("pageSize") || "30", 10);

    // Set state from URL params
    setSearchTerm(urlSearchTerm);
    setFilterStatus(urlStatus);
    setFilterCategory(urlCategory);
    setFilterFormat(urlFormat);
    setFilterRound(urlRound);
    setFilterVenue(urlVenue);
    setCurrentPage(urlPage);
    setPageSize(urlPageSize);

    // Update previous filters ref
    previousFilters.current = {
      category: urlCategory,
      format: urlFormat,
      round: urlRound,
      venue: urlVenue,
    };

    setIsInitialized(true);

    // Reset the flag after a short delay to allow state updates to complete
    setTimeout(() => {
      isRestoringFromURL.current = false;
    }, 100);
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
    if (tournamentName) urlParams.set("name", tournamentName);
    if (filterStatus !== "all") urlParams.set("status", filterStatus);
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
      tournament: id,
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
      tournament: id!,
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
    id,
    filterCategory,
    filterFormat,
    filterRound,
    filterVenue,
    currentPage,
    pageSize,
  ]);

  // Reset to first page when filters change
  useEffect(() => {
    if (!isInitialized || isRestoringFromURL.current) return;
    setCurrentPage(1);
  }, [isInitialized, filterStatus, filterCategory, filterFormat, filterRound, filterVenue]);

  // Reset round filter when format changes to avoid invalid selections
  useEffect(() => {
    if (!isInitialized || isRestoringFromURL.current) return;

    // Only reset if format actually changed (not when restoring from URL)
    if (previousFilters.current.format !== filterFormat) {
      setFilterRound("all");
      previousFilters.current.format = filterFormat;
    }
  }, [isInitialized, filterFormat]);

  // Reset format filter when category changes
  useEffect(() => {
    if (!isInitialized || isRestoringFromURL.current) return;

    // Only reset if category actually changed (not when restoring from URL)
    if (previousFilters.current.category !== filterCategory) {
      setFilterFormat("all");
      previousFilters.current.category = filterCategory;
    }
  }, [isInitialized, filterCategory]);

  // Reset venue filter when category changes
  useEffect(() => {
    if (!isInitialized || isRestoringFromURL.current) return;

    // Only reset if tournament or category actually changed (not when restoring from URL)
    if (previousFilters.current.category !== filterCategory) {
      setFilterVenue("all");
      previousFilters.current.category = filterCategory;
    }
  }, [isInitialized, filterCategory]);

  const fetchData = useCallback(async (filters?: MatchFilters) => {
    // Temporarily disable filter resets during data refresh
    const wasRestoringFromURL = isRestoringFromURL.current;
    isRestoringFromURL.current = true;

    try {
      setLoading(true);

      const [matchesResponse] = await Promise.all([(await getRefereeMatches(filters)).data]);

      // Extract data from new response structure
      const allMatches: Match[] = matchesResponse.data.matches.items || [];
      const totalCount: number = matchesResponse.data.matches.pagination.total || 0;
      const totalPagesCount: number = matchesResponse.data.matches.pagination.totalPages || 1;

      // Extract match status counts from response
      const inProgressCount: number = matchesResponse.data.inProgressCount || 0;
      const incomingCount: number = matchesResponse.data.incomingCount || 0;
      const completedCount: number = matchesResponse.data.completedCount || 0;

      // Extract filter options from response (if available)
      const apiFilterOptions: FilterOptions = matchesResponse.data.filters || {
        tournaments: [],
        categories: [],
        formats: [],
        rounds: [],
        venues: [],
      };

      setMatches(allMatches);
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
      // Restore the previous state of the flag
      isRestoringFromURL.current = wasRestoringFromURL;
    }
  }, []);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const handleAssignReferee = async (refereeIds: string[]) => {
    if (!selectedMatch || !isAdmin || refereeIds.length === 0) return;

    try {
      setAssigningReferee(true);

      // Assign each referee to the match
      const assignPromises = refereeIds.map((refereeId) => assignRefereeToMatch(refereeId, selectedMatch.id));

      await Promise.all(assignPromises);

      const currentFilters: MatchFilters = {
        search: debouncedSearchTerm || undefined,
        status: filterStatus !== "all" ? (filterStatus as "completed" | "in-progress" | "upcoming") : undefined,
        tournament: id,
        category: filterCategory !== "all" ? filterCategory : undefined,
        format: filterFormat !== "all" ? filterFormat : undefined,
        round: filterRound !== "all" ? filterRound : undefined,
        venue: filterVenue !== "all" ? filterVenue : undefined,
        pageSize: pageSize,
        pageNumber: currentPage,
      };
      // Refresh data to show updated assignments
      await fetchData(currentFilters);
      setShowAssignmentModal(false);
      setSelectedMatch(null);
    } catch (error: any) {
      console.error("Error assigning referees:", error);
      alert(`Failed to assign ${refereeIds.length > 1 ? "referees" : "referee"}. Please try again.`);
    } finally {
      setAssigningReferee(false);
    }
  };

  const handleBulkAssignReferee = async (refereeIds: string[], matchIds: string[]) => {
    if (!isAdmin) return;
    try {
      setBulkAssigningReferee(true);

      // Assign each referee to all selected matches
      const assignPromises = refereeIds.map((refereeId) => bulkAssignRefereeToMatches(refereeId, matchIds));

      await Promise.all(assignPromises);

      // Refresh data to show updated assignments
      const currentFilters: MatchFilters = {
        search: debouncedSearchTerm || undefined,
        status: filterStatus !== "all" ? (filterStatus as "completed" | "in-progress" | "upcoming") : undefined,
        tournament: id,
        category: filterCategory !== "all" ? filterCategory : undefined,
        format: filterFormat !== "all" ? filterFormat : undefined,
        round: filterRound !== "all" ? filterRound : undefined,
        venue: filterVenue !== "all" ? filterVenue : undefined,
        pageSize: pageSize,
        pageNumber: currentPage,
      };
      await fetchData(currentFilters);
      setShowBulkAssignmentModal(false);
      setSelectedMatches(new Set());
    } catch (error: any) {
      console.error("Error bulk assigning referees:", error);
      const errorMessage =
        error.message ||
        `Failed to assign ${refereeIds.length > 1 ? "referees" : "referee"} to one or more matches. Please try again.`;
      alert(errorMessage);
    } finally {
      setBulkAssigningReferee(false);
    }
  };

  const handleBulkUpdateScores = async (matchScores: { matchId: string; gameScores: MatchGameScore[] }[]) => {
    if (!isAdmin) return;
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
      const currentFilters: MatchFilters = {
        search: debouncedSearchTerm || undefined,
        status: filterStatus !== "all" ? (filterStatus as "completed" | "in-progress" | "upcoming") : undefined,
        tournament: id,
        category: filterCategory !== "all" ? filterCategory : undefined,
        format: filterFormat !== "all" ? filterFormat : undefined,
        round: filterRound !== "all" ? filterRound : undefined,
        venue: filterVenue !== "all" ? filterVenue : undefined,
        pageSize: pageSize,
        pageNumber: currentPage,
      };
      await fetchData(currentFilters);
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
    if (!isAdmin) return;
    try {
      await unassignRefereeFromMatch(refereeId, matchId);

      const currentFilters: MatchFilters = {
        search: debouncedSearchTerm || undefined,
        status: filterStatus !== "all" ? (filterStatus as "completed" | "in-progress" | "upcoming") : undefined,
        tournament: id,
        category: filterCategory !== "all" ? filterCategory : undefined,
        format: filterFormat !== "all" ? filterFormat : undefined,
        round: filterRound !== "all" ? filterRound : undefined,
        venue: filterVenue !== "all" ? filterVenue : undefined,
        pageSize: pageSize,
        pageNumber: currentPage,
      };
      await fetchData(currentFilters);
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
      const currentFilters: MatchFilters = {
        search: debouncedSearchTerm || undefined,
        status: filterStatus !== "all" ? (filterStatus as "completed" | "in-progress" | "upcoming") : undefined,
        tournament: id,
        category: filterCategory !== "all" ? filterCategory : undefined,
        format: filterFormat !== "all" ? filterFormat : undefined,
        round: filterRound !== "all" ? filterRound : undefined,
        venue: filterVenue !== "all" ? filterVenue : undefined,
        pageSize: pageSize,
        pageNumber: currentPage,
      };
      await fetchData(currentFilters);
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
    setFilterCategory("all");
    setFilterFormat("all");
    setFilterRound("all");
    setFilterVenue("all");

    // Update previous filters ref to prevent unwanted resets
    previousFilters.current = {
      category: "all",
      format: "all",
      round: "all",
      venue: "all",
    };
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

  const handleFilterCategoryChange = (value: string) => {
    setFilterCategory(value);
    previousFilters.current.category = value;
  };

  const handleFilterFormatChange = (value: string) => {
    setFilterFormat(value);
    previousFilters.current.format = value;
  };

  const handleFilterRoundChange = (value: string) => {
    setFilterRound(value);
    previousFilters.current.round = value;
  };

  const handleFilterVenueChange = (value: string) => {
    setFilterVenue(value);
    previousFilters.current.venue = value;
  };

  const handleFilterStatusChange = (value: string) => {
    setFilterStatus(value);
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
    return <VolleyballLoading message="Loading matches..." size="medium" />;
  }

  if (error) {
    return (
      <div className="matches-management">
        <div className="error-container">
          <h2>Error</h2>
          <p>{error}</p>
          <button
            onClick={() =>
              fetchData({
                search: debouncedSearchTerm || undefined,
                status: filterStatus !== "all" ? (filterStatus as "completed" | "in-progress" | "upcoming") : undefined,
                tournament: id,
                category: filterCategory !== "all" ? filterCategory : undefined,
                format: filterFormat !== "all" ? filterFormat : undefined,
              })
            }
            className="retry-button"
          >
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
        <h1>{tournamentName}</h1>
        <p>Manage all matches and referee assignments</p>
      </div>

      <div className="filters-section">
        <button className={`filters-toggle ${showFilters ? "expanded" : ""}`} onClick={toggleFilters}>
          <span>Filters & Search</span>
          <span className="toggle-icon">▼</span>
        </button>

        <div className={`filters-row ${showFilters ? "visible" : ""}`}>
          <div className="filter-group">
            <select
              value={filterCategory}
              onChange={(e) => handleFilterCategoryChange(e.target.value)}
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
            <select
              value={filterFormat}
              onChange={(e) => handleFilterFormatChange(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Formats</option>
              {filterOptions.formats?.map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <select
              value={filterRound}
              onChange={(e) => handleFilterRoundChange(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Rounds</option>
              {filterOptions.rounds?.map((round) => (
                <option key={round} value={round}>
                  {round}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <select
              value={filterVenue}
              onChange={(e) => handleFilterVenueChange(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Venues</option>
              {filterOptions.venues?.map((venue) => (
                <option key={venue} value={venue}>
                  {venue}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <select
              value={filterStatus}
              onChange={(e) => handleFilterStatusChange(e.target.value)}
              className="filter-select"
            >
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
              filterCategory !== "all" ||
              filterFormat !== "all" ||
              filterRound !== "all" ||
              filterVenue !== "all"
                ? "No matches match your current filters. Try adjusting your search or filters."
                : "There are no matches available to manage."}
            </p>
            {(searchTerm ||
              filterStatus !== "all" ||
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
            {matches?.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                onUpdateScore={handleUpdateScore}
                onAssignReferee={openAssignmentModal}
                onUnassignReferee={handleUnassignReferee}
                showAdminActions={isAdmin}
                showUpdateScore={!match.isCompleted || isAdmin}
                isSelectable={isAdmin}
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
        onClose={() => setShowAssignmentModal(false)}
        onAssign={handleAssignReferee}
        loading={assigningReferee}
      />

      {/* Bulk Assignment Modal */}
      <BulkAssignRefereeModal
        isOpen={showBulkAssignmentModal}
        selectedMatches={matches?.filter((match) => selectedMatches.has(match.id)) || []}
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
