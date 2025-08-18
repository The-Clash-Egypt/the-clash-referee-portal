import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { getRefereeMatches, Match } from "../api/matches";
import { RootState } from "../../../store";
import MatchCard from "../../shared/components/MatchCard";
import "./MatchesDashboard.scss";

interface TournamentSection {
  name: string;
  matches: Match[];
  isExpanded: boolean;
}

const MatchesDashboard: React.FC = () => {
  const user = useSelector((state: RootState) => state.user.user);
  const [tournamentSections, setTournamentSections] = useState<TournamentSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const response = await getRefereeMatches();
      const matches: Match[] = response.data;
      const sections = organizeMatchesByTournament(matches);
      setTournamentSections(sections);
    } catch (error: any) {
      console.error("Error fetching matches:", error);
      setError("An error occurred while loading matches");
    } finally {
      setLoading(false);
    }
  };

  const organizeMatchesByTournament = (matches: Match[]): TournamentSection[] => {
    const sections: { [key: string]: Match[] } = {};

    matches.forEach((match) => {
      const tournamentName = match.tournamentName || "Other";

      if (!sections[tournamentName]) {
        sections[tournamentName] = [];
      }
      sections[tournamentName].push(match);
    });

    return Object.keys(sections)
      .sort()
      .map((name) => ({
        name,
        matches: sections[name].sort((a, b) => {
          if (a.startTime && b.startTime) {
            return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
          }
          return 0;
        }),
        isExpanded: false,
      }));
  };

  const toggleSection = (index: number) => {
    setTournamentSections((prev) =>
      prev.map((section, i) => (i === index ? { ...section, isExpanded: !section.isExpanded } : section))
    );
  };

  const handleViewDetails = (match: Match) => {
    // TODO: Implement view details functionality
    console.log("View details for match:", match.id);
  };

  const handleUpdateScore = (match: Match) => {
    // TODO: Implement update score functionality
    console.log("Update score for match:", match.id);
  };

  const handleAssignReferee = (match: Match) => {
    // TODO: Implement assign referee functionality
    console.log("Assign referee for match:", match.id);
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

  return (
    <div className="matches-dashboard">
      <div className="dashboard-header">
        <h1>Matches</h1>
        <p>View and manage your assigned matches</p>
      </div>

      {tournamentSections.length === 0 ? (
        <div className="no-matches">
          <div className="empty-state">
            <h2>No Matches</h2>
            <p>You don't have any matches assigned yet</p>
          </div>
        </div>
      ) : (
        <div className="tournament-sections">
          {tournamentSections.map((section, index) => (
            <div key={index} className="tournament-section">
              <div className="tournament-header" onClick={() => toggleSection(index)}>
                <h2 className="tournament-title">{section.name}</h2>
                <div className="tournament-info">
                  <span className="match-count">{section.matches.length} matches</span>
                  <span className={`expand-icon ${section.isExpanded ? "expanded" : ""}`}>▼</span>
                </div>
              </div>

              {section.isExpanded && (
                <div className="matches-grid">
                  {section.matches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      onUpdateScore={handleUpdateScore}
                      onAssignReferee={isAdmin ? handleAssignReferee : undefined}
                      showAdminActions={isAdmin}
                      showUpdateScore={true}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MatchesDashboard;
