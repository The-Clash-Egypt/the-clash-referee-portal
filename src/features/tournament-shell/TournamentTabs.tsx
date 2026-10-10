import React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { VenueManagement } from "../venue/pages";
import MexicanoStageCards from "../mexicano/components/MexicanoStageCards";
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

/** The Mexicano tab: the tournament's Mexicano stages; each opens its runner (a focused screen outside the tabs). */
export const MexicanoTab: React.FC = () => {
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const name = searchParams.get("name");

  return (
    <div className="tournament-tab tournament-tab--mexicano">
      <MexicanoStageCards
        tournamentId={id}
        onOpen={(formatId) =>
          navigate(`/tournaments/${id}/mexicano/${formatId}${name ? `?name=${encodeURIComponent(name)}` : ""}`)
        }
      />
    </div>
  );
};
