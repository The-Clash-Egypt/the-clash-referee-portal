import React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Spinner } from "../../../ui/Spinner";
import MexicanoStageCards from "../components/MexicanoStageCards";
import "./MexicanoStagesPage.scss";

/**
 * tournaments/:id/mexicano — the Mexicano tab: the tournament's stages as cards; each opens its runner, a focused
 * screen outside the tabs (keeping ?name=, which the tournament screens title themselves from).
 */
const MexicanoStagesPage: React.FC = () => {
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const name = searchParams.get("name");

  return (
    <div className="mexicano-stages">
      <MexicanoStageCards
        tournamentId={id}
        loading={<Spinner label="Loading Mexicano..." />}
        onOpen={(formatId) =>
          navigate(`/tournaments/${id}/mexicano/${formatId}${name ? `?name=${encodeURIComponent(name)}` : ""}`)
        }
      />
    </div>
  );
};

export default MexicanoStagesPage;
