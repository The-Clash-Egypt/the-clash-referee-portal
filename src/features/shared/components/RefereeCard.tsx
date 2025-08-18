import React from "react";
import { Referee } from "../../matches/api/matches";
import "./RefereeCard.scss";

interface RefereeCardProps {
  referee: Referee;
  onRemove?: (referee: Referee) => void;
  showActions?: boolean;
  className?: string;
}

const RefereeCard: React.FC<RefereeCardProps> = ({ referee, onRemove, showActions = true, className = "" }) => {
  const handleRemove = () => {
    if (onRemove) {
      onRemove(referee);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRefereeStatus = () => {
    // TODO: Implement actual status logic based on referee availability
    return "active";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "#10b981";
      case "inactive":
        return "#6b7280";
      case "busy":
        return "#f59e0b";
      default:
        return "#6b7280";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "Available";
      case "inactive":
        return "Inactive";
      case "busy":
        return "Assigned";
      default:
        return "Unknown";
    }
  };

  const status = getRefereeStatus();

  return (
    <div className={`referee-card ${className}`}>
      <div className="referee-header">
        <div className="referee-avatar">
          <div className="avatar-placeholder">{getInitials(referee.fullName)}</div>
        </div>

        <div
          className="status-badge"
          style={{ backgroundColor: `${getStatusColor(status)}20`, color: getStatusColor(status) }}
        >
          {getStatusText(status)}
        </div>
      </div>

      <div className="referee-info">
        <h3 className="referee-name">{referee.fullName}</h3>

        <div className="referee-contact">
          <div className="contact-item">
            <span className="contact-text">{referee.email}</span>
          </div>

          <div className="contact-item">
            <span className="contact-text">{referee.phoneNumber || "—"}</span>
          </div>
        </div>
      </div>

      {showActions && onRemove && (
        <div className="referee-actions">
          <button className="action-button danger" onClick={handleRemove}>
            Remove
          </button>
        </div>
      )}
    </div>
  );
};

export default RefereeCard;
