import { MexicanoSession } from "./types";

/** Where the event stands, for the status pill and the matches-page card. */
export const statusLine = (session: MexicanoSession): string => {
  if (session.ended) return "Finished";
  if (session.currentRound === 0) return "Not started";
  if (session.currentRoundScored < session.currentRoundTotal)
    return `Waiting for scores (${session.currentRoundScored} of ${session.currentRoundTotal} in)`;
  return "Ready for next round";
};

export const roundLabel = (session: MexicanoSession): string =>
  session.currentRound === 0
    ? `${session.plannedRounds} rounds planned`
    : `Round ${session.currentRound} of ${session.plannedRounds}`;
