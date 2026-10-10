import React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../../../store";
import MexicanoRunner from "../components/MexicanoRunner";
import { canRunMexicano } from "../permissions";

/** tournaments/:id/mexicano/:formatId — the route shell around MexicanoRunner. */
const MexicanoPage: React.FC = () => {
  const { id, formatId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.user.user);

  if (!formatId) return null;

  // Back to the Mexicano tab, where the stage cards are; the tournament screens title themselves from ?name=.
  const name = searchParams.get("name");
  const back = () => navigate(`/tournaments/${id}/mexicano${name ? `?name=${encodeURIComponent(name)}` : ""}`);

  return <MexicanoRunner formatId={formatId} canRun={canRunMexicano(user)} onBack={back} />;
};

export default MexicanoPage;
