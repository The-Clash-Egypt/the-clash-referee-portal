import React from "react";
import { Tournament } from "../types";
import "./TournamentCard.scss";

interface TournamentCardProps {
  tournament: Tournament;
  onSelect?: (tournament: Tournament) => void;
  showActions?: boolean;
}

const TournamentCard: React.FC<TournamentCardProps> = ({ tournament, onSelect, showActions = false }) => {
  const handleSelect = () => {
    if (onSelect) {
      onSelect(tournament);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "status-active";
      case "inactive":
        return "status-inactive";
      case "upcoming":
        return "status-upcoming";
      case "completed":
        return "status-completed";
      default:
        return "status-default";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "Active";
      case "inactive":
        return "Inactive";
      case "upcoming":
        return "Upcoming";
      case "completed":
        return "Completed";
      default:
        return status;
    }
  };

  return (
    <div className="tournament-card" onClick={handleSelect}>
      <div className="card-header">
        <div className="tournament-name">{tournament.name}</div>
        <div className={`status-indicator ${getStatusColor(tournament.status)}`}></div>
      </div>

      <div className="card-content">
        <div className="status-info">
          <span className="status-label">Status</span>
          <span className={`status-value ${getStatusColor(tournament.status)}`}>
            {getStatusText(tournament.status)}
          </span>
        </div>

        {tournament.categories && tournament.categories.length > 0 && (
          <div className="categories-info">
            <span className="categories-label">Categories</span>
            <div className="categories-list">
              {tournament.categories.slice(0, 3).map((category, index) => (
                <span key={index} className="category-tag">
                  {category}
                </span>
              ))}
              {tournament.categories.length > 3 && (
                <span className="category-count">+{tournament.categories.length - 3}</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="card-footer">
        <span className="view-details">View Details →</span>
      </div>
    </div>
  );
};

export default TournamentCard;
