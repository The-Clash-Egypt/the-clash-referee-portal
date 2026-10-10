import React from "react";
import { Match, MatchGameScore } from "../types/match";
import FinishConfirm from "./score/FinishConfirm";
import ScoreboardView from "./score/ScoreboardView";
import TypedScoreForm from "./score/TypedScoreForm";
import { useScoreState } from "./score/useScoreState";

interface UpdateScoreDialogProps {
  isOpen: boolean;
  match: Match | null;
  onClose: () => void;
  onSubmit: (gameScores: MatchGameScore[]) => Promise<void>;
  loading: boolean;
  venueAccessToken?: string;
  matchAccessToken?: string; // match QR guest page
  openInFullscreen?: boolean; // guest pages: always the scoreboard; the back arrow keeps the score
}

/**
 * Scoring one match (portal redesign: mockups scoreboard-landscape-v2.html and match-flow-v2.html phone 3). It opens
 * on the scoreboard — upright, or sideways when the phone is turned or ⟳ forces it — except Americano/Mexicano, which
 * open on typed entry (the per-set inputs in the responsive sheet); the guest pages always get the scoreboard. Every
 * change updates the live score; the final save goes through a confirmation. No early `return null` when closed:
 * typed entry's drawer must stay mounted to slide out.
 */
const UpdateScoreDialog: React.FC<UpdateScoreDialogProps> = ({
  isOpen,
  match,
  onClose,
  onSubmit,
  loading,
  venueAccessToken,
  matchAccessToken,
  openInFullscreen = false,
}) => {
  const score = useScoreState({
    isOpen,
    match,
    onClose,
    onSubmit,
    venueAccessToken,
    matchAccessToken,
    openInFullscreen,
  });
  const open = isOpen && match !== null;

  return (
    <>
      {open && match && score.surface === "scoreboard" ? (
        <ScoreboardView match={match} score={score} loading={loading} />
      ) : null}

      {/* Rendered only on typed entry, so switching to the scoreboard takes it (and its scroll lock) away at once. */}
      {score.surface === "typed" ? <TypedScoreForm isOpen={open} match={match} score={score} loading={loading} /> : null}

      {open && match && score.surface === "typed" && score.showConfirmation ? (
        <FinishConfirm
          match={match}
          homeName={score.homeName}
          awayName={score.awayName}
          sets={score.playedGames}
          saving={loading}
          onCancel={score.cancelConfirm}
          onSave={score.confirmSave}
        />
      ) : null}
    </>
  );
};

export default UpdateScoreDialog;
