import { LiveStageKind, MexicanoSession } from "./types";

/** Where the event stands, for the status pill and the matches-page card. */
export const statusLine = (session: MexicanoSession): string => {
  if (session.ended) return "Finished";
  if (session.currentRound === 0) return "Not started";
  if (session.currentRoundScored < session.currentRoundTotal)
    return `Waiting for scores (${session.currentRoundScored} of ${session.currentRoundTotal} in)`;
  return "Ready for next round";
};

/** "Round 3 of 8"; an open-ended stage (no planned rounds, Roulette) has no "of". */
export const roundLabel = (session: MexicanoSession): string => {
  const openEnded = session.plannedRounds === 0;
  if (session.currentRound === 0) return openEnded ? "Open-ended" : `${session.plannedRounds} rounds planned`;
  return openEnded ? `Round ${session.currentRound}` : `Round ${session.currentRound} of ${session.plannedRounds}`;
};

/** The stage's format; older servers don't say, and only ran Mexicano. */
export const stageKind = (session: MexicanoSession): LiveStageKind => session.blockType ?? "Mexicano";

/**
 * Roulette: when the current round had to repeat line-ups (or, one unit a side, matches) because nothing fresh was
 * left for the group, say how many; null otherwise.
 */
export const repeatNote = (session: MexicanoSession): string | null => {
  const { lineUps = 0, matches = 0 } = session.currentRoundRepeats ?? {};
  if (lineUps + matches <= 0) return null;
  const [n, one, many] = lineUps > 0 ? [lineUps, "line-up", "line-ups"] : [matches, "match", "matches"];
  return `No fresh line-ups left for everyone here — ${n} ${n === 1 ? one : many} in this round ${
    n === 1 ? "was" : "were"
  } played before.`;
};
