import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../../ui/Button";
import { Tag } from "../../../ui/Tag";
import { useToast } from "../../../ui/Toast";
import { matchListKeys } from "../../matches/hooks/useMatchList";
import { finishAmericano, getAmericanoMatches } from "../api/americano";
import { mexicanoErrorMessage } from "../api/mexicano";
import {
  americanoEnded,
  americanoStatus,
  canFinishEarly,
  finishConfirmText,
  finishedText,
  finishPlan,
} from "../americanoText";
import { stageKeys } from "../stages";
import { TournamentStage } from "../types";
import "./MexicanoStageCards.scss";

interface AmericanoStageCardProps {
  tournamentId: string;
  stage: TournamentStage;
  /** Organizer: may finish the stage early. */
  canRun: boolean;
}

/**
 * An Americano stage on the stages tab: the Mexicano cards' white card, but not a link (Americano has no runner; its
 * matches are on the Matches tab). Says where the stage stands and, for organizers, finishes it early: the unscored
 * matches go and the leaderboard is final.
 */
const AmericanoStageCard: React.FC<AmericanoStageCardProps> = ({ tournamentId, stage, canRun }) => {
  const queryClient = useQueryClient();
  const { show } = useToast();
  const [busy, setBusy] = useState(false);
  // Read again on every visit: scores come in from the Matches tab and the courts.
  const { data: matches } = useQuery({
    queryKey: stageKeys.americanoMatches(stage.formatId),
    queryFn: () => getAmericanoMatches(stage.formatId),
    staleTime: 0,
  });

  // Until the schedule loads, the server's word on whether the stage is over is all there is.
  const status = matches ? americanoStatus(matches, stage.isEnded) : stage.isEnded ? "Finished" : null;
  const ended = matches ? americanoEnded(matches, stage.isEnded) : !!stage.isEnded;
  const canFinish = canRun && !!matches && canFinishEarly(matches, stage.isEnded);

  const finish = async () => {
    if (!matches || !window.confirm(finishConfirmText(finishPlan(matches)))) return;
    setBusy(true);
    try {
      show(finishedText(await finishAmericano(stage.formatId)), { tone: "ok" });
    } catch (error) {
      show(mexicanoErrorMessage(error, "Couldn't finish the event."), { tone: "error" });
    }
    // Either way the schedule may have moved on (finished here, or elsewhere): read this card, the tab's stages and
    // the matches lists again. The button stays busy until the card has caught up.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: stageKeys.americanoMatches(stage.formatId) }),
      queryClient.invalidateQueries({ queryKey: stageKeys.list(tournamentId) }),
      queryClient.invalidateQueries({ queryKey: matchListKeys.all }),
    ]);
    setBusy(false);
  };

  return (
    <article
      className="mexicano-stage-card mexicano-stage-card--static"
      aria-label={`${stage.categoryName} · ${stage.stageName}`}
    >
      {status && (
        <span className="mexicano-stage-card__tags">
          <Tag tone={ended || !matches?.length ? "grey" : "warn"}>{status}</Tag>
        </span>
      )}
      <span className="mexicano-stage-card__title">{stage.categoryName}</span>
      <span className="mexicano-stage-card__meta">
        <span>{stage.stageName}</span>
      </span>
      {canFinish && (
        <span className="mexicano-stage-card__actions">
          <Button variant="tint" size="sm" loading={busy} onClick={finish}>
            {busy ? "Finishing..." : "Finish early"}
          </Button>
        </span>
      )}
    </article>
  );
};

export default AmericanoStageCard;
