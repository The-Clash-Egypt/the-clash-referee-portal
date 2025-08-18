import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { getRefereeMatches, Match } from "../api/matches";
import { RootState } from "../../../store";
import MatchCard from "../../shared/components/MatchCard";
import "./MatchesDashboard.scss";

const MatchesDashboard: React.FC = () => {
  const user = useSelector((state: RootState) => state.user.user);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTournament, setFilterTournament] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterFormat, setFilterFormat] = useState<string>("all");
  const [filterRound, setFilterRound] = useState<string>("all");
  const [filterVenue, setFilterVenue] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchMatches();
  }, []);

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

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const response = await getRefereeMatches();
      const allMatches: Match[] = response.data;
      setMatches(allMatches);
    } catch (error: any) {
      console.error("Error fetching matches:", error);
      setError("An error occurred while loading matches");
    } finally {
      setLoading(false);
    }
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

  // Get unique values for filter options
  const getUniqueTournaments = () => {
    const tournaments = matches.map((match) => match.tournamentName).filter(Boolean);
    return Array.from(new Set(tournaments)) as string[];
  };

  const getUniqueCategories = () => {
    const filteredMatches =
      filterTournament === "all" ? matches : matches.filter((match) => match.tournamentName === filterTournament);

    const categories = filteredMatches.map((match) => match.categoryName).filter(Boolean);
    return Array.from(new Set(categories)) as string[];
  };

  const getUniqueFormats = () => {
    let filteredMatches = matches;

    if (filterTournament !== "all") {
      filteredMatches = filteredMatches.filter((match) => match.tournamentName === filterTournament);
    }

    if (filterCategory !== "all") {
      filteredMatches = filteredMatches.filter((match) => match.categoryName === filterCategory);
    }

    const formats = filteredMatches.map((match) => match.format).filter(Boolean);
    return Array.from(new Set(formats)) as string[];
  };

  const getUniqueRounds = () => {
    const rounds = matches.map((match) => match.round).filter(Boolean);
    const allRounds = Array.from(new Set(rounds)) as string[];

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

  const getUniqueVenues = () => {
    let filteredMatches = matches;

    if (filterTournament !== "all") {
      filteredMatches = filteredMatches.filter((match) => match.tournamentName === filterTournament);
    }

    if (filterCategory !== "all") {
      filteredMatches = filteredMatches.filter((match) => match.categoryName === filterCategory);
    }

    const venues = filteredMatches.map((match) => match.venue).filter(Boolean);
    return Array.from(new Set(venues)) as string[];
  };

  const filteredMatches = matches.filter((match) => {
    const matchesSearch =
      match.homeTeamName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      match.awayTeamName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      match.venue?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      match.tournamentName?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === "all" || getMatchStatus(match) === filterStatus;
    const matchesTournament = filterTournament === "all" || match.tournamentName === filterTournament;
    const matchesCategory = filterCategory === "all" || match.categoryName === filterCategory;
    const matchesFormat = filterFormat === "all" || match.format === filterFormat;
    const matchesRound = filterRound === "all" || match.round === filterRound;
    const matchesVenue = filterVenue === "all" || match.venue === filterVenue;

    return (
      matchesSearch &&
      matchesStatus &&
      matchesTournament &&
      matchesCategory &&
      matchesFormat &&
      matchesRound &&
      matchesVenue
    );
  });

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
    // TODO: Implement update score functionality
    console.log("Update score for match:", match.id);
  };

  const isAdmin = user?.role === "admin";

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
          <button onClick={fetchMatches} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const uniqueTournaments = getUniqueTournaments();
  const uniqueCategories = getUniqueCategories();
  const uniqueFormats = getUniqueFormats();
  const uniqueRounds = getUniqueRounds();

  return (
    <div className="matches-dashboard">
      <div className="dashboard-header">
        <h1>Matches</h1>
        <p>View and manage your assigned matches</p>
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
              {uniqueTournaments.map((tournament) => (
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
              {uniqueCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <select value={filterFormat} onChange={(e) => setFilterFormat(e.target.value)} className="filter-select">
              <option value="all">All Formats</option>
              {uniqueFormats.map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <select value={filterRound} onChange={(e) => setFilterRound(e.target.value)} className="filter-select">
              <option value="all">All Rounds</option>
              {uniqueRounds.map((round) => (
                <option key={round} value={round}>
                  {round}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <select value={filterVenue} onChange={(e) => setFilterVenue(e.target.value)} className="filter-select">
              <option value="all">All Venues</option>
              {getUniqueVenues().map((venue) => (
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

      <div className="matches-stats">
        <div className="matches-count">
          <span className="stat-label">Total Assigned Matches</span>
          <span className="stat-value">{matches.length}</span>
        </div>
        <div className="status-stats">
          <div className="stat-item">
            <span className="stat-label">Upcoming</span>
            <span className="stat-value">{matches.filter((m) => getMatchStatus(m) === "upcoming").length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">In Progress</span>
            <span className="stat-value">{matches.filter((m) => getMatchStatus(m) === "in-progress").length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Completed</span>
            <span className="stat-value">{matches.filter((m) => getMatchStatus(m) === "completed").length}</span>
          </div>
        </div>
      </div>

      {filteredMatches.length === 0 ? (
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
          {filteredMatches
            .sort((a, b) => new Date(b.startTime || "").getTime() - new Date(a.startTime || "").getTime())
            .map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                onUpdateScore={handleUpdateScore}
                showAdminActions={false}
                showAssignReferee={false}
                showUpdateScore={true}
              />
            ))}
        </div>
      )}
    </div>
  );
};

export default MatchesDashboard;
