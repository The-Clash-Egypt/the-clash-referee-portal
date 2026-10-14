import React from "react";
import { useSelector } from "react-redux";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { RootState } from "../../../store";
import { Button } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { Spinner } from "../../../ui/Spinner";
import MexicanoStageCards from "../components/MexicanoStageCards";
import { canFinishAmericano } from "../permissions";
import "./MexicanoStagesPage.scss";

/**
 * tournaments/:id/mexicano — the stages tab ("Mexicano", "Americano", "Roulette" or "Stages"): the tournament's stages
 * as cards. A Mexicano or Roulette card opens its runner, a focused screen outside the tabs (keeping ?name=, which the tournament screens
 * title themselves from); an Americano card lets organizers finish the stage early.
 */
const MexicanoStagesPage: React.FC = () => {
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.user.user);
  const name = searchParams.get("name");

  return (
    <div className="mexicano-stages">
      <MexicanoStageCards
        tournamentId={id}
        canRun={canFinishAmericano(user)}
        loading={<Spinner label="Loading stages..." />}
        empty={<EmptyState icon="list" title="No Americano, Mexicano or Roulette stages" />}
        failed={(retry) => (
          <EmptyState
            icon="alert"
            title="Error"
            body="An error occurred while loading data"
            action={
              <Button variant="tint" icon="refresh" onClick={retry}>
                Try again
              </Button>
            }
          />
        )}
        onOpen={(formatId) =>
          navigate(`/tournaments/${id}/mexicano/${formatId}${name ? `?name=${encodeURIComponent(name)}` : ""}`)
        }
      />
    </div>
  );
};

export default MexicanoStagesPage;
