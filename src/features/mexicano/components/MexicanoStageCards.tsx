import React, { useEffect, useState } from "react";
import { Icon } from "../../../ui/Icon";
import { Tag, TagTone } from "../../../ui/Tag";
import { getMexicanoSession, getMexicanoStages } from "../api/mexicano";
import { roundLabel, statusLine } from "../sessionText";
import { MexicanoSession, MexicanoStage } from "../types";
import "./MexicanoStageCards.scss";

interface MexicanoStageCardsProps {
  tournamentId: string;
  onOpen: (formatId: string) => void;
  /** Shown while the stages load (e.g. a spinner on the Mexicano tab). Nothing by default. */
  loading?: React.ReactNode;
  /** Shown when the tournament has no Mexicano stage. Nothing by default. */
  empty?: React.ReactNode;
  /** Shown when the stages couldn't load; `retry` asks again. Nothing by default. */
  failed?: (retry: () => void) => React.ReactNode;
}

type Card = { stage: MexicanoStage; session: MexicanoSession | null };

/** Grey before round 1 and once finished, orange tint while scores are due, green when the next round can start. */
const statusTone = (session: MexicanoSession): TagTone => {
  if (session.ended || session.currentRound === 0) return "grey";
  return session.currentRoundScored < session.currentRoundTotal ? "warn" : "ok";
};

/**
 * The way into a Mexicano stage's live page (spec 2026-09-29 §4.1): one white card per stage on the tournament's
 * Mexicano tab, saying where the event stands. Without a stage, or when they can't load, it renders `empty` /
 * `failed` (nothing by default).
 */
const MexicanoStageCards: React.FC<MexicanoStageCardsProps> = ({ tournamentId, onOpen, loading, empty, failed }) => {
  const [cards, setCards] = useState<Card[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setLoadFailed(false);
    (async () => {
      try {
        const stages = await getMexicanoStages(tournamentId);
        if (cancelled) return;
        if (stages.length === 0) {
          // Most tournaments: nothing to show. Returning prev skips the re-render when already empty.
          setCards((prev) => (prev.length === 0 ? prev : []));
          return;
        }
        // A stage whose session fails to load still gets a card: its page shows the error.
        const sessions = await Promise.all(stages.map((stage) => getMexicanoSession(stage.formatId).catch(() => null)));
        if (!cancelled) setCards(stages.map((stage, i) => ({ stage, session: sessions[i] })));
      } catch {
        if (!cancelled) {
          setCards([]);
          setLoadFailed(true);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId, attempt]);

  if (!loaded && loading) return <>{loading}</>;
  if (loaded && loadFailed && failed) return <>{failed(() => setAttempt((n) => n + 1))}</>;
  if (cards.length === 0) return loaded && !loadFailed && empty ? <>{empty}</> : null;

  return (
    <section className="mexicano-stage-cards" aria-label="Mexicano stages">
      {cards.map(({ stage, session }) => (
        <button key={stage.formatId} type="button" className="mexicano-stage-card" onClick={() => onOpen(stage.formatId)}>
          {session && (
            <span className="mexicano-stage-card__tags">
              <Tag tone={statusTone(session)}>{statusLine(session)}</Tag>
            </span>
          )}
          <span className="mexicano-stage-card__title">{stage.categoryName}</span>
          <span className="mexicano-stage-card__meta">
            {/* The default stage name says nothing on the Mexicano tab; a stage's own name does. */}
            {stage.stageName !== "Mexicano" && <span>{stage.stageName}</span>}
            <span>{session ? roundLabel(session) : "Tap to open"}</span>
          </span>
          <Icon name="chevron-right" size={16} className="mexicano-stage-card__chevron" />
        </button>
      ))}
    </section>
  );
};

export default MexicanoStageCards;
