import { useState, useEffect } from "react";
import { Tournament } from "../types";
import TournamentCard from "../components/TournamentCard";
import { useNavigate } from "react-router-dom";
import { useTournaments } from "../hooks";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faTimes, faExclamationCircle, faCircle } from "@fortawesome/free-solid-svg-icons";
import "./styles.scss";

const Tournaments = () => {
  const navigate = useNavigate();
  const { data: tournaments = [], isLoading: loading, error, refetch } = useTournaments();

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    active: false,
    upcoming: true,
    past: true,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSports, setSelectedSports] = useState<string[]>([]);

  // Get unique sports (or types) from all tournaments
  const tournamentSports = Array.from(
    new Set(tournaments.filter((t) => t.sport || (t as any).type).map((t) => (t.sport || (t as any).type) as string)),
  ).sort();

  const handleTournamentSelect = (tournament: Tournament) => {
    navigate(`/tournaments/${tournament.id}/matches?name=${tournament.name}`);
  };

  const toggleSection = (status: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [status]: !prev[status],
    }));
  };

  // Filter tournaments based on search query and sport/type filter (applies to all sections)
  const filteredTournaments = tournaments.filter((tournament) => {
    // First apply search filter
    const matchesSearch = tournament.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    // Apply sport/type filter across all tournaments when one or more sports are selected
    if (selectedSports.length > 0) {
      return selectedSports.includes((tournament.sport || (tournament as any).type) as string);
    }

    return true;
  });

  // Sort tournaments by date based on status
  const sortTournamentsByDate = (tournaments: Tournament[], status: string) => {
    return tournaments.sort((a, b) => {
      const dateA = new Date(a.startDate).getTime();
      const dateB = new Date(b.startDate).getTime();

      if (status === "upcoming" || status === "active") {
        // For upcoming and active tournaments, sort by earliest first
        return dateA - dateB;
      } else {
        // For past tournaments, sort by latest first
        return dateB - dateA;
      }
    });
  };

  // Group tournaments by status
  const groupedTournaments = filteredTournaments.reduce(
    (acc, tournament) => {
      const status = tournament.status;
      if (!acc[status]) {
        acc[status] = [];
      }
      acc[status].push(tournament);
      return acc;
    },
    {} as Record<string, Tournament[]>,
  );

  // Apply sorting to each status group
  Object.keys(groupedTournaments).forEach((status) => {
    groupedTournaments[status] = sortTournamentsByDate(groupedTournaments[status], status);
  });

  // Auto-expand sections that contain search results or when sport filters are active
  useEffect(() => {
    if ((searchQuery && filteredTournaments.length > 0) || selectedSports.length > 0) {
      const sectionsToExpand: string[] = [];

      // Check which sections have matching tournaments
      Object.keys(groupedTournaments).forEach((status) => {
        if (groupedTournaments[status].length > 0) {
          sectionsToExpand.push(status);
        }
      });

      // Expand all sections that have results
      if (sectionsToExpand.length > 0) {
        setCollapsedSections((prev) => {
          const newState = { ...prev };
          let hasChanges = false;

          sectionsToExpand.forEach((status) => {
            if (prev[status] !== false) {
              newState[status] = false; // false means expanded
              hasChanges = true;
            }
          });

          return hasChanges ? newState : prev;
        });
      }
    }
  }, [searchQuery, filteredTournaments.length, selectedSports.length]);

  const toggleSport = (sport: string) => {
    setSelectedSports((prev) => (prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]));
  };

  // (removed: per-section expand effect) handled by combined auto-expand effect above

  // Define status order and labels
  const statusConfig = {
    active: { label: "Live Tournaments" },
    upcoming: { label: "Upcoming Tournaments" },
    past: { label: "Past Tournaments" },
  };

  const statusOrder = ["active", "upcoming", "past"];

  if (loading) {
    return (
      <div className={`tournament-list`}>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading tournaments...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`tournament-list`}>
        <div className="error-state">
          <div className="error-icon">
            <FontAwesomeIcon icon={faExclamationCircle} />
          </div>
          <p>Failed to load tournaments. Please try again.</p>
          <button className="btn btn-primary" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (tournaments.length === 0) {
    return (
      <div className={`tournament-list`}>
        <div className="empty-state">
          <div className="empty-icon">
            <FontAwesomeIcon icon={faCircle} />
          </div>
          <p>No assigned tournaments</p>
          <p className="empty-subtitle">
            You don't have any assigned matches in tournaments yet. Check back when you're assigned to referee matches.
          </p>
        </div>
      </div>
    );
  }

  if (searchQuery && filteredTournaments.length === 0) {
    return (
      <div className={`tournament-list`}>
        <div className="tournament-header">
          <div className="header-content">
            <div className="title-section">
              <h1 className="page-title">Tournaments</h1>
              <p className="page-subtitle">Browse and manage all tournaments</p>
            </div>
          </div>
        </div>

        <div className="search-section">
          <div className="search-bar">
            <div className="search-input-container">
              <div className="search-icon">
                <FontAwesomeIcon icon={faSearch} />
              </div>
              <input
                type="text"
                placeholder="Search tournaments by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button className="clear-search" onClick={() => setSearchQuery("")} title="Clear search">
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="empty-state">
          <div className="empty-icon">
            <FontAwesomeIcon icon={faSearch} />
          </div>
          <p>No tournaments found matching "{searchQuery}"</p>
          <p className="empty-subtitle">Try adjusting your search terms</p>
          <button className="btn btn-primary" onClick={() => setSearchQuery("")}>
            Clear Search
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`tournament-list`}>
      <div className="tournament-header">
        <div className="header-content">
          <div className="title-section">
            <h1 className="page-title">Tournaments</h1>
            <p className="page-subtitle">Browse and manage all tournaments</p>
          </div>
        </div>
      </div>

      <div className="search-section">
        <div className="search-bar">
          <div className="search-input-container">
            <div className="search-icon">
              <FontAwesomeIcon icon={faSearch} />
            </div>
            <input
              type="text"
              placeholder="Search tournaments by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button className="clear-search" onClick={() => setSearchQuery("")} title="Clear search">
                <FontAwesomeIcon icon={faTimes} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sports filter (applies across all sections) */}
      {tournamentSports.length > 0 && (
        <div className="sports-filter-top">
          <div className="sport-pills">
            <button
              type="button"
              className={`pill ${selectedSports.length === 0 ? "active" : ""}`}
              onClick={() => setSelectedSports([])}
            >
              All Sports
            </button>
            {tournamentSports.map((sport) => (
              <button
                key={sport}
                type="button"
                className={`pill ${selectedSports.includes(sport) ? "active" : ""}`}
                onClick={() => toggleSport(sport)}
              >
                {sport}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="tournament-sections">
        {statusOrder.map((status) => {
          const statusTournaments = groupedTournaments[status] || [];
          if (statusTournaments.length === 0) return null;

          const isCollapsed = collapsedSections[status] ?? false;

          return (
            <div key={status} className="tournament-section">
              <div className="section-header" onClick={() => toggleSection(status)}>
                <div className="section-title-group">
                  <h2 className="section-title">{statusConfig[status as keyof typeof statusConfig].label}</h2>
                  <div className="section-count">{statusTournaments.length}</div>
                  <div className={`toggle-icon ${isCollapsed ? "collapsed" : "expanded"}`}>▼</div>
                </div>
                <div className="section-divider"></div>
              </div>

              <div
                className={`tournament-grid ${isCollapsed ? "collapsed" : "expanded"}`}
                style={{
                  maxHeight: isCollapsed ? "0px" : "none",
                  opacity: isCollapsed ? 0 : 1,
                  padding: isCollapsed ? "0" : "12px 0",
                }}
              >
                {statusTournaments.map((tournament) => (
                  <TournamentCard
                    key={tournament.id}
                    tournament={tournament}
                    onSelect={handleTournamentSelect}
                    showActions={false}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Tournaments;
