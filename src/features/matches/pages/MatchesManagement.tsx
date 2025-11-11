import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import PrintableView from "../components/PrintableView";
import SearchableDropdown from "../components/SearchableDropdown";
import VolleyballLoading from "../../../components/VolleyballLoading";
import { VenueManagement } from "../../venue/pages";
import { useParams, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../../../store";
import { Match, MatchGameScore, MatchFilters, FilterOptions } from "../types/match";
import { groupMatchesByDay, getTournamentDayDuration, getTournamentDayTimeRange } from "../../../utils/durationUtils";
import { AdminRole } from "../../auth/types/adminRoles";
import "./MatchesManagement.scss";
import "../components/PrintableView.scss";
import "../components/SearchableDropdown.scss";

const MatchesManagement: React.FC = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const tournamentName = searchParams.get("name");
  const user = useSelector((state: RootState) => state.user.user);

  const [matches, setMatches] = useState<Match[]>([]);
  const [totalMatches, setTotalMatches] = useState<number>(0);
  const [loading, setLoading] = useState(false);
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
  const [filterTeam, setFilterTeam] = useState<string>("all");
  const [filterReferee, setFilterReferee] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [showBulkAssignmentModal, setShowBulkAssignmentModal] = useState(false);
  const [bulkAssigningReferee, setBulkAssigningReferee] = useState(false);
  const [showBulkUpdateScoreModal, setShowBulkUpdateScoreModal] = useState(false);
  const [bulkUpdatingScores, setBulkUpdatingScores] = useState(false);
  const [showPrintableView, setShowPrintableView] = useState(false);
  const [printableViewType, setPrintableViewType] = useState<"venue" | "referee" | "team" | "general">("general");
  const [showBulkWhatsAppModal, setShowBulkWhatsAppModal] = useState(false);
  const [selectedReferee, setSelectedReferee] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"matches" | "venues">(() => {
    // Check if we're coming from tournaments page specifically (but not on refresh)
    const isFromTournaments =
      document.referrer &&
      document.referrer.includes(window.location.origin) &&
      document.referrer.includes("/tournaments") &&
      document.referrer !== window.location.href; // Not a refresh

    if (isFromTournaments) {
      // Always show matches when coming from tournaments page (but not on refresh)
      return "matches";
    }

    // Otherwise, use persisted tab (this will work on refresh too)
    const savedTab = localStorage.getItem("matches-management-active-tab");
    return savedTab === "matches" || savedTab === "venues" ? savedTab : "matches";
  });

  // Handle tab change with localStorage persistence
  const handleTabChange = (tab: "matches" | "venues") => {
    setActiveTab(tab);
    localStorage.setItem("matches-management-active-tab", tab);

    // Reset matches loaded flag when switching away from matches tab
    if (tab !== "matches") {
      setMatchesLoaded(false);
    }
  };

  // Reset tab to matches when leaving the page
  useEffect(() => {
    return () => {
      localStorage.setItem("matches-management-active-tab", "matches");
    };
  }, []);

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
    teams: [],
    referees: [],
    dates: [],
  });

  // URL params sync state
  const [isInitialized, setIsInitialized] = useState(false);
  const [matchesLoaded, setMatchesLoaded] = useState(false);

  // Sort matches by start time in ascending order
  const sortedMatches = useMemo(() => {
    if (!matches || matches.length === 0) return [];

    return [...matches].sort((a, b) => {
      // Handle cases where startTime might be undefined
      if (!a.startTime && !b.startTime) return 0;
      if (!a.startTime) return 1; // Put matches without start time at the end
      if (!b.startTime) return -1; // Put matches without start time at the end

      // Convert to Date objects and compare
      const dateA = new Date(a.startTime);
      const dateB = new Date(b.startTime);

      return dateA.getTime() - dateB.getTime();
    });
  }, [matches]);

  // Refs to track if filters are being restored from URL vs changed by user
  const isRestoringFromURL = useRef(false);
  const previousFilters = useRef({
    category: "all",
    format: "all",
    round: "all",
    venue: "all",
    team: "all",
    referee: "all",
    date: "all",
  });

  const isSuperAdmin = user?.adminRoles?.includes(AdminRole.SUPERADMIN);
  const isRefereeAdmin = user?.adminRoles?.includes(AdminRole.REFEREE_ADMIN);
  const hasFullAccess = isSuperAdmin || isRefereeAdmin;

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
    const urlTeam = urlParams.get("team") || "all";
    const urlReferee = urlParams.get("referee") || "all";
    const urlDate = urlParams.get("date") || "all";
    const urlPage = parseInt(urlParams.get("page") || "1", 10);
    const urlPageSize = parseInt(urlParams.get("pageSize") || "30", 10);

    // Set state from URL params
    setSearchTerm(urlSearchTerm);
    setFilterStatus(urlStatus);
    setFilterCategory(urlCategory);
    setFilterFormat(urlFormat);
    setFilterRound(urlRound);
    setFilterVenue(urlVenue);
    setFilterTeam(urlTeam);
    setFilterReferee(urlReferee);
    setFilterDate(urlDate);
    setCurrentPage(urlPage);
    setPageSize(urlPageSize);

    // Update previous filters ref
    previousFilters.current = {
      category: urlCategory,
      format: urlFormat,
      round: urlRound,
      venue: urlVenue,
      team: urlTeam,
      referee: urlReferee,
      date: urlDate,
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
    if (filterTeam !== "all") urlParams.set("team", filterTeam);
    if (filterReferee !== "all") urlParams.set("referee", filterReferee);
    if (filterDate !== "all") urlParams.set("date", filterDate);

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
    filterTeam,
    filterReferee,
    filterDate,
    currentPage,
    pageSize,
    tournamentName,
  ]);

  // Load matches data when matches tab is first activated
  useEffect(() => {
    if (!isInitialized || activeTab !== "matches" || matchesLoaded) return;

    setLoading(true);
    const filters: MatchFilters = {
      search: debouncedSearchTerm || undefined,
      status: filterStatus !== "all" ? (filterStatus as "completed" | "in-progress" | "upcoming") : undefined,
      tournament: id,
      category: filterCategory !== "all" ? filterCategory : undefined,
      format: filterFormat !== "all" ? filterFormat : undefined,
      round: filterRound !== "all" ? filterRound : undefined,
      venue: filterVenue !== "all" ? filterVenue : undefined,
      team: filterTeam !== "all" ? filterTeam : undefined,
      referee: filterReferee !== "all" ? filterReferee : undefined,
      date: filterDate !== "all" ? filterDate : undefined,
      pageSize: pageSize,
      pageNumber: currentPage,
    };

    fetchData(filters);
    setMatchesLoaded(true);
  }, [isInitialized, activeTab, matchesLoaded]);

  // Apply filters when they change (only for matches tab)
  useEffect(() => {
    if (!isInitialized || activeTab !== "matches") return;

    setLoading(true);
    const filters: MatchFilters = {
      search: debouncedSearchTerm || undefined,
      status: filterStatus !== "all" ? (filterStatus as "completed" | "in-progress" | "upcoming") : undefined,
      tournament: id,
      category: filterCategory !== "all" ? filterCategory : undefined,
      format: filterFormat !== "all" ? filterFormat : undefined,
      round: filterRound !== "all" ? filterRound : undefined,
      venue: filterVenue !== "all" ? filterVenue : undefined,
      team: filterTeam !== "all" ? filterTeam : undefined,
      referee: filterReferee !== "all" ? filterReferee : undefined,
      date: filterDate !== "all" ? filterDate : undefined,
      pageSize: pageSize,
      pageNumber: currentPage,
    };

    fetchData(filters);
    setMatchesLoaded(true);
  }, [
    debouncedSearchTerm,
    filterStatus,
    id,
    filterCategory,
    filterFormat,
    filterRound,
    filterVenue,
    filterTeam,
    filterReferee,
    filterDate,
    currentPage,
    pageSize,
  ]);

  // Reset to first page when filters change
  useEffect(() => {
    if (!isInitialized || isRestoringFromURL.current) return;
    setCurrentPage(1);
  }, [isInitialized, filterStatus, filterCategory, filterFormat, filterRound, filterVenue, filterTeam, filterReferee, filterDate]);

  // Reset matches loaded flag when filters change (except for pagination)
  useEffect(() => {
    if (!isInitialized || isRestoringFromURL.current) return;
    setMatchesLoaded(false);
  }, [
    isInitialized,
    debouncedSearchTerm,
    filterStatus,
    filterCategory,
    filterFormat,
    filterRound,
    filterVenue,
    filterTeam,
    filterReferee,
    filterDate,
  ]);

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

  const fetchData = useCallback(async (filters?: MatchFilters, showLoading: boolean = true) => {
    // Temporarily disable filter resets during data refresh
    const wasRestoringFromURL = isRestoringFromURL.current;
    isRestoringFromURL.current = true;

    try {
      if (showLoading) {
        setLoading(true);
      }

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
        teams: [],
        referees: [],
        dates: [],
      };

      // Debug: Log the filter options to see the actual structure
      console.log("Filter options from API:", {
        teams: apiFilterOptions.teams,
        referees: apiFilterOptions.referees,
        teamsType: typeof apiFilterOptions.teams,
        refereesType: typeof apiFilterOptions.referees,
        teamsLength: apiFilterOptions.teams?.length,
        refereesLength: apiFilterOptions.referees?.length,
      });

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
    if (!selectedMatch || !hasFullAccess || refereeIds.length === 0) return;

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
        team: filterTeam !== "all" ? filterTeam : undefined,
        referee: filterReferee !== "all" ? filterReferee : undefined,
        date: filterDate !== "all" ? filterDate : undefined,
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
    if (!hasFullAccess) return;
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
        team: filterTeam !== "all" ? filterTeam : undefined,
        referee: filterReferee !== "all" ? filterReferee : undefined,
        date: filterDate !== "all" ? filterDate : undefined,
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
    if (!hasFullAccess) return;
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
        team: filterTeam !== "all" ? filterTeam : undefined,
        referee: filterReferee !== "all" ? filterReferee : undefined,
        date: filterDate !== "all" ? filterDate : undefined,
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
    if (!hasFullAccess) return;
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
        team: filterTeam !== "all" ? filterTeam : undefined,
        referee: filterReferee !== "all" ? filterReferee : undefined,
        date: filterDate !== "all" ? filterDate : undefined,
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

  // Handle scoreboard close - refetch data to show updated scores
  const handleScoreboardClose = async () => {
    setShowUpdateScoreModal(false);
    setSelectedMatchForScore(null);
    // Refetch matches data to show any live score updates (without loading spinner)
    const currentFilters: MatchFilters = {
      search: debouncedSearchTerm || undefined,
      status: filterStatus !== "all" ? (filterStatus as "completed" | "in-progress" | "upcoming") : undefined,
      tournament: id,
      category: filterCategory !== "all" ? filterCategory : undefined,
      format: filterFormat !== "all" ? filterFormat : undefined,
      round: filterRound !== "all" ? filterRound : undefined,
      venue: filterVenue !== "all" ? filterVenue : undefined,
      team: filterTeam !== "all" ? filterTeam : undefined,
      referee: filterReferee !== "all" ? filterReferee : undefined,
      date: filterDate !== "all" ? filterDate : undefined,
      pageSize: pageSize,
      pageNumber: currentPage,
    };
    await fetchData(currentFilters, false); // Don't show loading spinner for background refresh
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
        team: filterTeam !== "all" ? filterTeam : undefined,
        referee: filterReferee !== "all" ? filterReferee : undefined,
        date: filterDate !== "all" ? filterDate : undefined,
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
    setFilterTeam("all");
    setFilterReferee("all");
    setFilterDate("all");

    // Update previous filters ref to prevent unwanted resets
    previousFilters.current = {
      category: "all",
      format: "all",
      round: "all",
      venue: "all",
      team: "all",
      referee: "all",
      date: "all",
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

  const handleFilterTeamChange = (value: string) => {
    setFilterTeam(value);
    previousFilters.current.team = value;
  };

  const handleFilterRefereeChange = (value: string) => {
    setFilterReferee(value);
    previousFilters.current.referee = value;
  };

  const handleFilterDateChange = (value: string) => {
    setFilterDate(value);
    previousFilters.current.date = value;
  };

  const handleExportView = (type: "venue" | "referee" | "team" | "general") => {
    setPrintableViewType(type);
    setShowPrintableView(true);
  };

  const handleCloseExportView = () => {
    setShowPrintableView(false);
  };

  const generateBulkWhatsAppMessage = (referee: any, refereeMatches: Match[]) => {
    const refereeName = referee.fullName || `${referee.firstName || ""} ${referee.lastName || ""}`.trim();
    const appUrl = window.location.origin;

    // Get tournament info from the first match (assuming all matches are from same tournament)
    const firstMatch = refereeMatches[0];
    const tournamentName = firstMatch?.tournamentName || "Tournament";

    // Group matches by category first, then by date within each category
    const matchesByCategory = refereeMatches.reduce((acc, match) => {
      const category = match.categoryName || "General";
      if (!acc[category]) acc[category] = [];
      acc[category].push(match);
      return acc;
    }, {} as Record<string, Match[]>);

    let message = `🏐 *Referee Assignment*

*Tournament:* ${tournamentName}
*Referee:* ${refereeName}
*Total Matches:* ${refereeMatches.length}

*Your Matches:*`;

    // Add matches grouped by category and then by date
    Object.entries(matchesByCategory).forEach(([category, categoryMatches]) => {
      message += `\n\n*${category}:*`;

      // Group matches within this category by date
      const matchesByDate = categoryMatches.reduce((acc, match) => {
        const date = match.startTime
          ? new Date(match.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : "TBD";
        if (!acc[date]) acc[date] = [];
        acc[date].push(match);
        return acc;
      }, {} as Record<string, Match[]>);

      Object.entries(matchesByDate).forEach(([date, matches]) => {
        message += `\n\n  *${date}:*`;
        matches.forEach((match) => {
          const time = match.startTime
            ? new Date(match.startTime).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })
            : "TBD";
          const teams = `${match.homeTeamName || "TBD"} vs ${match.awayTeamName || "TBD"}`;
          const venue = match.venue || "TBD";
          const round = match.round ? ` - ${match.round}` : "";
          message += `\n  • ${time} - ${teams} (${venue})${round}`;
        });
      });
    });

    message += `\n\n*Please confirm availability.*\n*Portal:* ${appUrl}`;

    return message;
  };

  // Get all unique referees from selected matches
  const getAllRefereesFromSelectedMatches = () => {
    const allReferees = new Map();

    selectedMatches.forEach((matchId) => {
      const match = matches.find((m) => m.id === matchId);
      if (match?.referees) {
        match.referees.forEach((referee) => {
          if (referee.phoneNumber) {
            allReferees.set(referee.id, referee);
          }
        });
      }
    });

    return Array.from(allReferees.values());
  };

  const handleBulkWhatsAppShare = () => {
    console.log("Bulk WhatsApp clicked, selected matches:", selectedMatches);
    const availableReferees = getAllRefereesFromSelectedMatches();
    console.log("Available referees:", availableReferees);

    if (availableReferees.length === 0) {
      alert("No referees with phone numbers found in selected matches");
      return;
    }

    console.log("Setting selected referees and opening modal");
    setSelectedReferee(availableReferees.map((ref) => ref.id)[0]);
    setShowBulkWhatsAppModal(true);
  };

  const sendBulkWhatsAppMessages = () => {
    const referee = getAllRefereesFromSelectedMatches().find((ref) => ref.id === selectedReferee);

    if (selectedReferee === "") {
      alert("No referees selected");
      return;
    }

    if (referee) {
      // Get all matches for this referee from selected matches
      const refereeMatches = matches.filter(
        (match) => selectedMatches.has(match.id) && match.referees?.some((ref) => ref.id === referee.id)
      );

      if (refereeMatches.length > 0) {
        const message = generateBulkWhatsAppMessage(referee, refereeMatches);
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${referee.phoneNumber}?text=${encodedMessage}`;

        // Open WhatsApp message
        window.open(whatsappUrl, "_blank");
      }
    }

    setShowBulkWhatsAppModal(false);
    setSelectedReferee("");
  };

  const getExportType = (): "venue" | "referee" | "team" | "general" => {
    if (filterVenue !== "all") return "venue";
    if (filterTeam !== "all") return "team";
    if (filterReferee !== "all") return "referee";
    return "general";
  };

  const getRefereeName = (refereeId: string) => {
    if (refereeId === "all") return "All Referees";
    const referee = filterOptions.referees?.find((ref) => {
      const id = typeof ref === "string" ? ref : ref.id;
      return id === refereeId;
    });
    return referee
      ? typeof referee === "string"
        ? referee
        : referee.fullName || referee.name || refereeId
      : refereeId;
  };

  const getTeamName = (teamId: string) => {
    if (teamId === "all") return "All Teams";
    const team = filterOptions.teams?.find((team) => {
      const id = typeof team === "string" ? team : team.id;
      return id === teamId;
    });
    return team ? (typeof team === "string" ? team : team.name || team.fullName || teamId) : teamId;
  };

  const getExportTitle = () => {
    const activeFilters = [];

    // Add status filter
    if (filterStatus !== "all") {
      activeFilters.push(`${filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)} matches`);
    }

    // Add category filter
    if (filterCategory !== "all") {
      activeFilters.push(`Category: ${filterCategory}`);
    }

    // Add format filter
    if (filterFormat !== "all") {
      activeFilters.push(`Format: ${filterFormat}`);
    }

    // Add round filter
    if (filterRound !== "all") {
      activeFilters.push(`Round: ${filterRound}`);
    }

    // Add venue filter
    if (filterVenue !== "all") {
      activeFilters.push(`Venue: ${filterVenue}`);
    }

    // Add team filter
    if (filterTeam !== "all") {
      activeFilters.push(`Team: ${getTeamName(filterTeam)}`);
    }

    // Add referee filter
    if (filterReferee !== "all") {
      activeFilters.push(`Referee: ${getRefereeName(filterReferee)}`);
    }

    // Add date filter
    if (filterDate !== "all") {
      const formattedDate = new Date(filterDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      activeFilters.push(`Date: ${formattedDate}`);
    }

    // Add search term if present
    if (searchTerm) {
      activeFilters.push(`Search: "${searchTerm}"`);
    }

    // If no filters are active, return default
    if (activeFilters.length === 0) {
      return "All Matches";
    }

    // Join filters with commas and limit length for display
    const title = activeFilters.join(", ");
    return title;
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
        <p>Manage all matches, referee assignments and venues</p>
      </div>

      {/* Tab Navigation */}
      {hasFullAccess && (
        <div className="tab-navigation">
          <button
            className={`tab-button ${activeTab === "matches" ? "active" : ""}`}
            onClick={() => handleTabChange("matches")}
          >
            Matches
          </button>
          <button
            className={`tab-button ${activeTab === "venues" ? "active" : ""}`}
            onClick={() => handleTabChange("venues")}
          >
            Venues
          </button>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === "matches" && (
        <>
          {/* Matches Management Header */}
          <div className="matches-management__header">
            <div className="matches-management__title">
              <h1>Matches Management</h1>
              <p>Manage all matches, referee assignments and scores for this tournament</p>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="matches-loading-container">
              <VolleyballLoading message="Loading matches..." size="medium" />
            </div>
          )}

          {/* Management Actions - Admin Only */}
          {!loading && hasFullAccess && totalMatches > 0 && (
            <div className="management-actions-section">
              {/* Export Controls - Compact */}
              <div className="export-controls-compact">
                <div className="export-info-compact">
                  <div className="export-label">Export Matches</div>
                  <div className="export-description">{getExportTitle()}</div>
                  <div className="export-count">{totalMatches} total matches</div>
                </div>
                <button
                  onClick={() => handleExportView(getExportType())}
                  className="export-btn-compact"
                  title="Export matches to PDF"
                >
                  Preview PDF
                </button>
              </div>
            </div>
          )}

          {!loading && totalMatches > 0 && (
            <div className="filters-section">
              <button className={`filters-toggle ${showFilters ? "expanded" : ""}`} onClick={toggleFilters}>
                <span>Filters</span>
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
                  <SearchableDropdown
                    options={filterOptions.teams || []}
                    value={filterTeam}
                    onChange={handleFilterTeamChange}
                    placeholder="All Teams"
                    className="filter-select"
                    showAllOption={true}
                    allOptionText="All Teams"
                  />
                </div>

                <div className="filter-group">
                  <SearchableDropdown
                    options={filterOptions.referees || []}
                    value={filterReferee}
                    onChange={handleFilterRefereeChange}
                    placeholder="All Referees"
                    className="filter-select"
                    showAllOption={true}
                    allOptionText="All Referees"
                  />
                </div>

                {filterOptions.dates && filterOptions.dates.length > 1 && (
                  <div className="filter-group">
                    <select
                      value={filterDate}
                      onChange={(e) => handleFilterDateChange(e.target.value)}
                      className="filter-select"
                    >
                      <option value="all">All Dates</option>
                      {filterOptions.dates.map((date) => {
                        const formattedDate = new Date(date).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        });
                        return (
                          <option key={date} value={date}>
                            {formattedDate}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                <div className="filter-group">
                  <button onClick={clearAllFilters} className="clear-filters-btn">
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bulk Assignment Controls */}
          {!loading && hasFullAccess && totalMatches > 0 && (
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
                        const allMatchIds = new Set(sortedMatches?.map((match) => match.id) || []);
                        setSelectedMatches(allMatchIds);
                      }}
                    >
                      Select All ({sortedMatches.length})
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
                  {hasFullAccess && (
                    <button className="bulk-whatsapp-btn" onClick={handleBulkWhatsAppShare}>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        style={{ marginRight: "8px" }}
                      >
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
                      </svg>
                      Bulk WhatsApp
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {!loading && totalMatches > 0 && (
            <div className="matches-stats">
              <div className="matches-count">
                <span className="stat-label">Total Matches</span>
                <span className="stat-value">{totalMatches}</span>
                {totalMatches > 0 && totalMatches !== totalMatches && (
                  <span className="current-page-info">(Showing {sortedMatches.length} on this page)</span>
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
          )}

          {!loading && (!matches || matches.length === 0) && (
            <div className="no-matches">
              <div className="empty-state">
                <h2>No Matches Found</h2>
                <p>
                  {searchTerm ||
                  filterStatus !== "all" ||
                  filterCategory !== "all" ||
                  filterFormat !== "all" ||
                  filterRound !== "all" ||
                  filterVenue !== "all" ||
                  filterTeam !== "all" ||
                  filterReferee !== "all" ||
                  filterDate !== "all"
                    ? "No matches match your current filters. Try adjusting your search or filters."
                    : "There are no matches available to manage."}
                </p>
                {(searchTerm ||
                  filterStatus !== "all" ||
                  filterCategory !== "all" ||
                  filterFormat !== "all" ||
                  filterRound !== "all" ||
                  filterVenue !== "all" ||
                  filterTeam !== "all" ||
                  filterReferee !== "all" ||
                  filterDate !== "all") && (
                  <button onClick={clearAllFilters} className="btn btn-primary">
                    Clear All Filters
                  </button>
                )}
              </div>
            </div>
          )}

          {!loading && matches && matches.length > 0 && (
            <>
              {/* Tournament Day Durations - Admin Only */}
              {hasFullAccess &&
                (() => {
                  const dayGroups = groupMatchesByDay(matches);
                  const daysWithDuration = Object.entries(dayGroups).filter(
                    ([_, dayMatches]) => getTournamentDayDuration(dayMatches) !== null
                  );

                  return daysWithDuration.length > 0 ? (
                    <div className="tournament-day-durations">
                      <h3 className="durations-title">Tournament Day Durations</h3>
                      <div className="durations-grid">
                        {daysWithDuration.map(([date, dayMatches]) => {
                          const dayDuration = getTournamentDayDuration(dayMatches);
                          const timeRange = getTournamentDayTimeRange(dayMatches);

                          return (
                            <div key={date} className="day-duration-card">
                              <div className="day-date">
                                {new Date(date).toLocaleDateString("en-US", {
                                  weekday: "long",
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })}
                              </div>
                              <div className="day-stats">
                                <div className="matches-count">
                                  {dayMatches.length} match{dayMatches.length !== 1 ? "es" : ""}
                                </div>
                                {dayDuration && (
                                  <div className="day-duration">
                                    <span className="duration-label">Duration:</span>
                                    <span className="duration-value">{dayDuration}</span>
                                  </div>
                                )}
                                {timeRange && (
                                  <div className="day-time-range">
                                    <span className="time-label">Time Range:</span>
                                    <span className="time-value">
                                      {timeRange.start.toLocaleTimeString("en-US", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        hour12: true,
                                      })}{" "}
                                      -{" "}
                                      {timeRange.end.toLocaleTimeString("en-US", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        hour12: true,
                                      })}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null;
                })()}

              <div className="matches-grid">
                {sortedMatches?.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    onUpdateScore={handleUpdateScore}
                    onAssignReferee={openAssignmentModal}
                    onUnassignReferee={handleUnassignReferee}
                    showAdminActions={hasFullAccess}
                    showUpdateScore={!match.isCompleted || hasFullAccess}
                    isSelectable={hasFullAccess}
                    isSelected={selectedMatches.has(match.id)}
                    onSelectionChange={handleMatchSelection}
                    showDuration={hasFullAccess}
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
            selectedMatches={sortedMatches?.filter((match) => selectedMatches.has(match.id)) || []}
            onClose={() => setShowBulkAssignmentModal(false)}
            onAssign={handleBulkAssignReferee}
            loading={bulkAssigningReferee}
          />

          {/* Update Score Modal */}
          <UpdateScoreDialog
            isOpen={showUpdateScoreModal}
            match={selectedMatchForScore}
            onClose={handleScoreboardClose}
            onSubmit={handleSubmitScore}
            openInFullscreen={!hasFullAccess}
            loading={updatingScore}
          />

          {/* Bulk Update Score Modal */}
          <BulkUpdateScoreModal
            isOpen={showBulkUpdateScoreModal}
            selectedMatches={sortedMatches?.filter((match) => selectedMatches.has(match.id)) || []}
            onClose={() => setShowBulkUpdateScoreModal(false)}
            onSubmit={handleBulkUpdateScores}
            loading={bulkUpdatingScores}
          />

          {/* Bulk WhatsApp Modal */}
          {showBulkWhatsAppModal && (
            <div className="bulk-whatsapp-modal-overlay">
              <div className="bulk-whatsapp-modal-content">
                <div className="bulk-whatsapp-modal-header">
                  <h3>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      style={{ marginRight: "8px", verticalAlign: "middle" }}
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
                    </svg>
                    Share matches on WhatsApp
                  </h3>
                  <button className="modal-close" onClick={() => setShowBulkWhatsAppModal(false)}>
                    ×
                  </button>
                </div>
                <div className="bulk-whatsapp-modal-body">
                  <p>Select one of the assigned referees to share matches on WhatsApp</p>
                  <div className="referees-list">
                    {getAllRefereesFromSelectedMatches().map((referee) => (
                      <div key={referee.id} className="referee-item">
                        <label
                          className="referee-checkbox"
                          onClick={() => {
                            setSelectedReferee(referee.id);
                          }}
                        >
                          <input
                            type="radio"
                            name="selectedReferee"
                            checked={selectedReferee === referee.id}
                            onChange={() => {
                              setSelectedReferee(referee.id);
                            }}
                          />
                          <span className="referee-name">{referee.fullName}</span>
                          <span className="referee-phone">{referee.phoneNumber}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setShowBulkWhatsAppModal(false)}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={sendBulkWhatsAppMessages}
                    disabled={selectedReferee === ""}
                  >
                    Send Message
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Export Views */}
          {showPrintableView && (
            <PrintableView
              matches={sortedMatches}
              tournamentName={tournamentName || "Tournament"}
              categoryName={filterCategory !== "all" ? filterCategory : undefined}
              viewType={printableViewType}
              venueName={filterVenue !== "all" ? filterVenue : undefined}
              refereeName={filterReferee !== "all" ? getRefereeName(filterReferee) : undefined}
              teamName={filterTeam !== "all" ? getTeamName(filterTeam) : undefined}
              formatName={filterFormat !== "all" ? filterFormat : undefined}
              onClose={handleCloseExportView}
            />
          )}
        </>
      )}

      {/* Venues Tab */}
      {activeTab === "venues" && (
        <div className="venues-tab">
          <VenueManagement tournamentId={id} />
        </div>
      )}
    </div>
  );
};

export default MatchesManagement;
