import React from "react";
import { Tournament } from "../types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendar } from "@fortawesome/free-solid-svg-icons";
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const calculateDuration = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return "Same day";
    } else if (diffDays === 1) {
      return "1 day";
    } else if (diffDays < 7) {
      return `${diffDays} days`;
    } else {
      const weeks = Math.floor(diffDays / 7);
      const remainingDays = diffDays % 7;
      if (remainingDays === 0) {
        return weeks === 1 ? "1 week" : `${weeks} weeks`;
      } else {
        return `${weeks}w ${remainingDays}d`;
      }
    }
  };

  return (
    <div className="tournament-card" onClick={handleSelect}>
      <div className="card-header">
        <div className="tournament-name">{tournament.name}</div>
        <div className={`status-indicator ${getStatusColor(tournament.status)}`}></div>
      </div>

      <div className="card-content">
        <div className="info-row">
          <div className="date-info">
            <FontAwesomeIcon icon={faCalendar} className="date-icon" />
            <span className="date-value">{formatDate(tournament.startDate)}</span>
          </div>
          <div className="duration-info">
            <span className="duration-value">{calculateDuration(tournament.startDate, tournament.endDate)}</span>
          </div>
        </div>

        {tournament.categories && tournament.categories.length > 0 && (
          <div className="categories-info">
            <div className="categories-list">
              {tournament.categories.slice(0, 2).map((category, index) => (
                <span key={index} className="category-tag">
                  {category}
                </span>
              ))}
              {tournament.categories.length > 2 && (
                <span className="category-count">+{tournament.categories.length - 2}</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="card-footer">
        <span className="view-details">View Details</span>
      </div>
    </div>
  );
};

export default TournamentCard;
