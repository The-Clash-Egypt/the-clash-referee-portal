import React from "react";
import { useParams } from "react-router-dom";
import { VenueManagement } from "../venue/pages";
import "./TournamentTabs.scss";

/** The Courts tab: today's Venues tab (full access only; the route wraps it in FullAccessOnly). */
export const CourtsTab: React.FC = () => {
  const { id } = useParams();
  return (
    <div className="tournament-tab tournament-tab--courts">
      <VenueManagement tournamentId={id} />
    </div>
  );
};
