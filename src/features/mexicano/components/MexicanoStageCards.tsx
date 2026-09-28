import React, { useEffect, useState } from "react";
import { getMexicanoSession, getMexicanoStages } from "../api/mexicano";
import { roundLabel, statusLine } from "../sessionText";
import { MexicanoSession, MexicanoStage } from "../types";
import "./MexicanoStageCards.scss";

interface MexicanoStageCardsProps {
  tournamentId: string;
  onOpen: (formatId: string) => void;
}

type Card = { stage: MexicanoStage; session: MexicanoSession | null };

/**
 * The way into a Mexicano stage's live page (spec 2026-09-29 §4.1): one card per stage on the
 * tournament's matches page, saying where the event stands. Nothing renders without one.
 */
const MexicanoStageCards: React.FC<MexicanoStageCardsProps> = ({ tournamentId, onOpen }) => {
  const [cards, setCards] = useState<Card[]>([]);

  useEffect(() => {
    let cancelled = false;
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
        if (!cancelled) setCards([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  if (cards.length === 0) return null;

  return (
    <section className="mexicano-stage-cards" aria-label="Mexicano stages">
      {cards.map(({ stage, session }) => (
        <button key={stage.formatId} type="button" className="mexicano-stage-card" onClick={() => onOpen(stage.formatId)}>
          <span className="mexicano-stage-card__eyebrow">Mexicano · live rounds</span>
          <span className="mexicano-stage-card__title">{stage.categoryName}</span>
          <span className="mexicano-stage-card__meta">
            {`${stage.stageName !== "Mexicano" ? `${stage.stageName} · ` : ""}${
              session ? `${roundLabel(session)} · ${statusLine(session)}` : "Tap to open"
            }`}
          </span>
          <span className="mexicano-stage-card__arrow" aria-hidden="true">
            →
          </span>
        </button>
      ))}
    </section>
  );
};

export default MexicanoStageCards;
