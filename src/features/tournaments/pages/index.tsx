import { useState } from "react";
import { Tournament } from "../types";
import TournamentCard from "../components/TournamentCard";
import { useNavigate } from "react-router-dom";
import { useTournaments } from "../hooks";
import "./styles.scss";

const Tournaments = () => {
  const navigate = useNavigate();
  const { data: tournaments = [], isLoading: loading, error, refetch } = useTournaments();

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    active: false,
    upcoming: true,
    past: true,
  });

  const handleTournamentSelect = (tournament: Tournament) => {
    navigate(`/tournaments/${tournament.id}/matches?name=${tournament.name}`);
  };

  const toggleSection = (status: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [status]: !prev[status],
    }));
  };

  // Group tournaments by status
  const groupedTournaments = tournaments.reduce((acc, tournament) => {
    const status = tournament.status;
    if (!acc[status]) {
      acc[status] = [];
    }
    acc[status].push(tournament);
    return acc;
  }, {} as Record<string, Tournament[]>);

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
          <div className="error-icon">!</div>
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
          <div className="empty-icon">○</div>
          <p>No tournaments found</p>
          <p className="empty-subtitle">Check back later for new tournaments</p>
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
          <div className="stats-section">
            <div className="stat-item">
              <div className="stat-number">{tournaments.length}</div>
              <div className="stat-label">Total</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">{groupedTournaments.active?.length || 0}</div>
              <div className="stat-label">Live</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">{groupedTournaments.upcoming?.length || 0}</div>
              <div className="stat-label">Upcoming</div>
            </div>
          </div>
        </div>
      </div>

      <div className="tournament-sections">
        {statusOrder.map((status) => {
          const statusTournaments = groupedTournaments[status] || [];
          if (statusTournaments.length === 0) return null;

          const isCollapsed = collapsedSections[status];

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
              <div className={`tournament-grid ${isCollapsed ? "collapsed" : "expanded"}`}>
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
