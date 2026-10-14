import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "../../../ui/Icon";
import { Tag, TagTone } from "../../../ui/Tag";
import { getMexicanoSession } from "../api/mexicano";
import { roundLabel, statusLine } from "../sessionText";
import { stageKeys, stagesLabel, useTournamentStages } from "../stages";
import { MexicanoSession, TournamentStage, isLiveStageKind } from "../types";
import AmericanoStageCard from "./AmericanoStageCard";
import "./MexicanoStageCards.scss";

interface MexicanoStageCardsProps {
  tournamentId: string;
  /** Opens a Mexicano or Roulette stage's runner. Americano stages have none: their cards aren't links. */
  onOpen: (formatId: string) => void;
  /** Organizer controls on the cards (Americano: Finish early). */
  canRun?: boolean;
  /** Shown while the stages load (e.g. a spinner on the stages tab). Nothing by default. */
  loading?: React.ReactNode;
  /** Shown when the tournament has no Americano, Mexicano or Roulette stage. Nothing by default. */
  empty?: React.ReactNode;
  /** Shown when the stages couldn't load; `retry` asks again. Nothing by default. */
  failed?: (retry: () => void) => React.ReactNode;
}

/** Grey before round 1 and once finished, orange tint while scores are due, green when the next round can start. */
const statusTone = (session: MexicanoSession): TagTone => {
  if (session.ended || session.currentRound === 0) return "grey";
  return session.currentRoundScored < session.currentRoundTotal ? "warn" : "ok";
};

/** The way into a live (Mexicano or Roulette) stage's runner, saying where the event stands. */
const MexicanoStageCard: React.FC<{ stage: TournamentStage; showDefaultName: boolean; onOpen: () => void }> = ({
  stage,
  showDefaultName,
  onOpen,
}) => {
  // Read again on every visit: rounds move on in the runner. A stage whose session fails to load still gets a card
  // (its page shows the error).
  const { data: session } = useQuery({
    queryKey: stageKeys.mexicanoSession(stage.formatId),
    queryFn: () => getMexicanoSession(stage.formatId),
    staleTime: 0,
  });

  return (
    <button type="button" className="mexicano-stage-card" onClick={onOpen}>
      {session && (
        <span className="mexicano-stage-card__tags">
          <Tag tone={statusTone(session)}>{statusLine(session)}</Tag>
        </span>
      )}
      <span className="mexicano-stage-card__title">{stage.categoryName}</span>
      <span className="mexicano-stage-card__meta">
        {/* The default stage name ("Mexicano", "Roulette") says nothing on a tab named after it; a stage's own name
            does (and next to stages of another kind, the default one does too). */}
        {(showDefaultName || stage.stageName !== stage.kind) && <span>{stage.stageName}</span>}
        <span>{session ? roundLabel(session) : "Tap to open"}</span>
      </span>
      <Icon name="chevron-right" size={16} className="mexicano-stage-card__chevron" />
    </button>
  );
};

/**
 * The tournament's stages tab (spec 2026-09-29 §4.1): one white card per Americano, Mexicano or Roulette stage, saying
 * where it stands. Mexicano and Roulette cards open their runner; Americano cards carry Finish early for organizers.
 * Without a stage, or when they can't load, it renders `empty` / `failed` (nothing by default).
 */
const MexicanoStageCards: React.FC<MexicanoStageCardsProps> = ({
  tournamentId,
  onOpen,
  canRun = false,
  loading,
  empty,
  failed,
}) => {
  // The tab bar's list, read again on every visit to the tab.
  const { data: stages, isError, isFetching, refetch } = useTournamentStages(tournamentId, { staleTime: 0 });

  if (!stages) {
    if (isError && !isFetching) return failed ? <>{failed(() => refetch())}</> : null;
    return loading ? <>{loading}</> : null;
  }
  if (stages.length === 0) return empty ? <>{empty}</> : null;

  const label = stagesLabel(stages);
  const mixed = label === "Stages";

  return (
    <section className="mexicano-stage-cards" aria-label={mixed ? "Stages" : `${label} stages`}>
      {stages.map((stage) =>
        !isLiveStageKind(stage.kind) ? (
          <AmericanoStageCard key={stage.formatId} tournamentId={tournamentId} stage={stage} canRun={canRun} />
        ) : (
          <MexicanoStageCard
            key={stage.formatId}
            stage={stage}
            showDefaultName={mixed}
            onOpen={() => onOpen(stage.formatId)}
          />
        )
      )}
    </section>
  );
};

export default MexicanoStageCards;
