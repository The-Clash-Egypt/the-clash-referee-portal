import { AmericanoFinishResult, AmericanoMatch } from "./types";

/** "1 round", "3 rounds". */
const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** "Round 3" → 3; null when the match has no round number. */
export const roundNumber = (round?: string | null): number | null => {
  const found = round ? /\d+/.exec(round) : null;
  return found ? Number(found[0]) : null;
};

/** A score is in (complete, or live points under way): finishing early keeps the match. */
export const hasScore = (match: AmericanoMatch): boolean => match.isCompleted || (match.gameScores?.length ?? 0) > 0;

/**
 * Whether the stage is over: the server says so, or every match is complete and has its round (the server's own rule,
 * less the planned-rounds count only it knows).
 */
export const americanoEnded = (matches: AmericanoMatch[], isEnded: boolean | null): boolean =>
  isEnded === true || (matches.length > 0 && matches.every((match) => match.isCompleted && !!match.round));

/**
 * Where the stage stands, for its card: "Finished", "No schedule yet", or the round being played — the lowest one with
 * a match still to finish — out of the rounds drawn, and how many of its matches are in: "Round 3 of 7 · 2/4 scored".
 */
export const americanoStatus = (matches: AmericanoMatch[], isEnded: boolean | null): string => {
  if (americanoEnded(matches, isEnded)) return "Finished";
  if (matches.length === 0) return "No schedule yet";
  const rounds = Array.from(
    new Set(matches.map((match) => roundNumber(match.round)).filter((n): n is number => n !== null))
  ).sort((a, b) => a - b);
  const inRound = (round: number) => matches.filter((match) => roundNumber(match.round) === round);
  const current =
    rounds.find((round) => inRound(round).some((match) => !match.isCompleted)) ?? rounds[rounds.length - 1];
  const shown = current === undefined ? matches : inRound(current);
  const scored = `${shown.filter((match) => match.isCompleted).length}/${shown.length} scored`;
  return current === undefined ? scored : `Round ${current} of ${rounds.length} · ${scored}`;
};

/** Organizers may finish early once a score is in, until the stage is over. */
export const canFinishEarly = (matches: AmericanoMatch[], isEnded: boolean | null): boolean =>
  !americanoEnded(matches, isEnded) && matches.some(hasScore);

/** What finishing now does: the rounds with a score in are kept, every match without one is removed. */
export interface FinishPlan {
  rounds: number;
  unplayed: number;
}

export const finishPlan = (matches: AmericanoMatch[]): FinishPlan => {
  const scored = matches.filter(hasScore);
  return {
    rounds: new Set(scored.map((match) => match.round).filter(Boolean)).size,
    unplayed: matches.length - scored.length,
  };
};

export const finishConfirmText = ({ rounds, unplayed }: FinishPlan): string =>
  `Finish after ${count(rounds, "round", "rounds")}? ${count(unplayed, "unplayed match", "unplayed matches")} ` +
  "will be removed and the leaderboard becomes final. This can't be undone.";

export const finishedText = ({ roundsPlayed, matchesRemoved }: AmericanoFinishResult): string =>
  `Finished after ${count(roundsPlayed, "round", "rounds")} — ` +
  `${count(matchesRemoved, "unplayed match", "unplayed matches")} removed.`;
