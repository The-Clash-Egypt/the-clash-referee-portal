import { useEffect, useRef, useState } from "react";
import { Match, MatchGameScore, isFixedPointsFormat, sideDisplayName } from "../../types/match";
import { updateLiveScore } from "../../api/matches";
import { cellsFromGameScores, hasAnyScore, otherSideScore, validateGameScores } from "../../../../utils/scoreValidation";

/** What is on screen: the big +1 scoreboard, or the per-set inputs (typed entry). */
export type ScoreMode = "scoreboard" | "typed";
/** The latest live-score call of this opening: none yet, saved, or failed. */
export type LiveStatus = "idle" | "saved" | "failed";
export type Side = "home" | "away";

/** A live update the server refused for another reason than the link (the scoreboard's status line says it). */
export const LIVE_SCORE_FAILED = "Failed to update live score. Please try again.";
const LINK_EXPIRED = "Your access link is invalid or has expired. Please contact the tournament organizer.";

/** What the scoreboard's back arrow leaves behind on the guest pages, so re-opening the same match carries on. */
interface ScoreSnapshot {
  matchId: string;
  scores: MatchGameScore[];
  setIndex: number;
}

export interface ScoreStateOptions {
  isOpen: boolean;
  match: Match | null;
  onClose: () => void;
  onSubmit: (gameScores: MatchGameScore[]) => Promise<void>;
  venueAccessToken?: string;
  matchAccessToken?: string;
  /** The guest pages: always the scoreboard, and the back arrow keeps the score for the same match. */
  openInFullscreen: boolean;
}

const EMPTY_GAME: MatchGameScore = { gameNumber: 1, homeScore: 0, awayScore: 0 };

const played = (score: MatchGameScore) => score.homeScore > 0 || score.awayScore > 0;

/**
 * Everything the score dialog does, whichever view is on screen (UpdateScoreDialog before the redesign): the game
 * list, the set on screen, adding and removing sets, sides, the switch-sides reminder, typed Americano/Mexicano
 * autofill, validation, the live score sent 500 ms after every change (once a point is logged), the expired-link
 * fallback, and the confirmation before the final save.
 */
export function useScoreState({
  isOpen,
  match,
  onClose,
  onSubmit,
  venueAccessToken,
  matchAccessToken,
  openInFullscreen,
}: ScoreStateOptions) {
  const fixedPoints = isFixedPointsFormat(match?.formatType);
  // Americano/Mexicano (one game to a points total) start on typed entry, everything else on the scoreboard; the
  // guest pages always start on the scoreboard.
  const startMode: ScoreMode = openInFullscreen || !fixedPoints ? "scoreboard" : "typed";

  const [mode, setMode] = useState<ScoreMode>(startMode);
  const [gameScores, setGameScores] = useState<MatchGameScore[]>([]);
  const [originalGameScores, setOriginalGameScores] = useState<MatchGameScore[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [selectedSetIndex, setSelectedSetIndex] = useState(0);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [hasLoggedFirstPoint, setHasLoggedFirstPoint] = useState(false);
  const [sidesSwapped, setSidesSwapped] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [switchCourtDismissedAt, setSwitchCourtDismissedAt] = useState<number | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("idle");
  // A ref, not state: it is read once when the dialog opens and must never re-initialise an open dialog.
  const snapshotRef = useRef<ScoreSnapshot | null>(null);
  // Numbers the live calls, so only the latest one's answer is shown.
  const liveCallRef = useRef(0);

  // Every opening (or another match) starts on its own view, and without a confirm prompt — a late click on the frozen
  // Save while the drawer slid out would otherwise leave one waiting. Adjusted while rendering, so nothing flashes.
  const openingKey = isOpen && match ? match.id : null;
  const [currentOpening, setCurrentOpening] = useState<string | null>(openingKey);
  if (openingKey !== currentOpening) {
    setCurrentOpening(openingKey);
    if (openingKey !== null) {
      setMode(startMode);
      setShowConfirmation(false);
    }
  }

  // Initialize game scores when the match changes
  useEffect(() => {
    if (!match || !isOpen) return;
    let initialScores: MatchGameScore[] = [];
    let setIndex: number;

    // Guest pages: carry on from the back arrow's snapshot, but only for the match it was taken from (live scoring
    // would otherwise write it into another match). It is used up here, so a later re-initialisation — e.g. the page
    // applying a save's result — reads the match instead.
    const snapshot = snapshotRef.current;
    snapshotRef.current = null;
    if (openInFullscreen && snapshot && snapshot.matchId === match.id && snapshot.scores.length > 0) {
      initialScores = [...snapshot.scores];
      setIndex = snapshot.setIndex;
    } else {
      if (match.gameScores && match.gameScores.length > 0) {
        initialScores.push(...match.gameScores);
      }
      if (initialScores.length === 0) {
        initialScores.push({ ...EMPTY_GAME });
      }
      setIndex = initialScores.length - 1; // the set being played
    }

    // Americano/Mexicano matches are exactly one game — never carry extra sets
    if (isFixedPointsFormat(match.formatType)) {
      initialScores = initialScores.slice(0, 1);
    }

    setGameScores(initialScores);
    setOriginalGameScores([...initialScores]); // the scores an expired link puts back
    setSelectedSetIndex(Math.max(0, Math.min(setIndex, initialScores.length - 1)));
    setErrors([]);
    setIsUnauthorized(false);
    setHasLoggedFirstPoint(false);
    setLiveStatus("idle");
    liveCallRef.current += 1; // an answer still on its way belongs to the last opening
  }, [match, isOpen, openInFullscreen]);

  const sendLiveScore = async (scores: MatchGameScore[]) => {
    if (!match?.id) return;
    const call = ++liveCallRef.current;

    try {
      await updateLiveScore({ matchId: match.id, gameScores: scores }, { venueAccessToken, matchAccessToken });
      if (call === liveCallRef.current) setLiveStatus("saved");
    } catch (error) {
      console.error("Failed to update live score:", error);

      if ((error as { response?: { status?: number } })?.response?.status === 401) {
        setIsUnauthorized(true);
        setErrors([LINK_EXPIRED]);
        // Reset scores to original values
        setGameScores([...originalGameScores]);
      } else {
        setErrors([LIVE_SCORE_FAILED]);
        if (call === liveCallRef.current) setLiveStatus("failed");
      }
    }
  };

  // Send live score updates when game scores change (500 ms debounce), but only after the first point is logged.
  useEffect(() => {
    // Don't send live score updates if user is unauthorized
    if (isUnauthorized) return;

    const hasAnyPoints = gameScores.some(played);
    if (hasAnyPoints && !hasLoggedFirstPoint) {
      setHasLoggedFirstPoint(true);
    }

    if (hasLoggedFirstPoint) {
      const timeoutId = setTimeout(() => {
        sendLiveScore(gameScores);
      }, 500); // 500ms debounce

      return () => clearTimeout(timeoutId);
    }
    // sendLiveScore is left out on purpose: it is new on every render, and the debounce restarts only on a change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameScores, isUnauthorized, hasLoggedFirstPoint]);

  const bestOf = match?.bestOf || 1;
  const isBestOfOne = bestOf === 1;

  // Best of N allows up to N games, until one side has won the majority.
  const canAddMoreSets = (): boolean => {
    if (!match || fixedPoints) return false;
    const homeWins = gameScores.filter((score) => score.homeScore > score.awayScore).length;
    const awayWins = gameScores.filter((score) => score.homeScore < score.awayScore).length;
    const setsNeededToWin = Math.ceil(bestOf / 2);
    if (homeWins >= setsNeededToWin || awayWins >= setsNeededToWin) return false;
    return gameScores.length < bestOf;
  };
  const canAddSet = !isBestOfOne && canAddMoreSets();

  const updateGameScore = (gameNumber: number, field: "homeScore" | "awayScore", value: string) => {
    const numericValue = value === "" ? 0 : Math.max(0, parseInt(value) || 0);
    setGameScores((prev) =>
      prev.map((score) => (score.gameNumber === gameNumber ? { ...score, [field]: numericValue } : score))
    );
  };

  // A typed Americano/Mexicano score fills in the other side. The scoreboard's +/- buttons count points one at a
  // time, so they go straight to updateGameScore.
  const typeScore = (gameNumber: number, field: "homeScore" | "awayScore", value: string) => {
    updateGameScore(gameNumber, field, value);
    const other = match ? otherSideScore(match, value === "" ? null : Math.max(0, parseInt(value) || 0)) : null;
    if (other !== null) updateGameScore(gameNumber, field === "homeScore" ? "awayScore" : "homeScore", String(other));
  };

  const currentGame = gameScores[selectedSetIndex] || EMPTY_GAME;

  const changePoint = (side: Side, action: "add" | "subtract") => {
    const game = gameScores[selectedSetIndex];
    if (!game) return;
    const current = side === "home" ? game.homeScore : game.awayScore;
    const next = action === "add" ? current + 1 : Math.max(0, current - 1);
    updateGameScore(game.gameNumber, side === "home" ? "homeScore" : "awayScore", next.toString());
  };

  const addSet = () => {
    const nextGameNumber = gameScores.length + 1;
    setGameScores((prev) => [...prev, { gameNumber: nextGameNumber, homeScore: 0, awayScore: 0 }]);
    // On the scoreboard the new set is the one to play; typed entry just gets another row.
    if (mode === "scoreboard") setSelectedSetIndex(nextGameNumber - 1);
  };

  const removeSet = (gameNumber: number) => {
    const removedIndex = gameScores.findIndex((score) => score.gameNumber === gameNumber);
    if (removedIndex === -1) return;

    // Renumber 1..n: the server only accepts contiguous game numbers, and addSet numbers by count.
    const remaining = gameScores
      .filter((_, index) => index !== removedIndex)
      .map((score, index) => ({ ...score, gameNumber: index + 1 }));
    setGameScores(remaining);
    // Keep the scoreboard on the same set, and never past the last one.
    setSelectedSetIndex((current) =>
      Math.max(0, Math.min(current > removedIndex ? current - 1 : current, remaining.length - 1))
    );
  };

  const validateScores = (): boolean => {
    const cells = cellsFromGameScores(gameScores);
    const newErrors: string[] = [];
    if (!hasAnyScore(cells)) {
      newErrors.push("At least one game must have scores entered.");
    }
    if (match) {
      newErrors.push(...validateGameScores(match, cells));
    }
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  /** Finish match / Save Scores: why it can't be saved, or the confirmation. */
  const submit = () => {
    if (!validateScores()) return;
    setShowConfirmation(true);
  };

  const cancelConfirm = () => setShowConfirmation(false);

  const confirmSave = async () => {
    try {
      await onSubmit(gameScores.filter(played));
      setShowConfirmation(false);
      snapshotRef.current = null; // saved: nothing to carry on from
      onClose();
    } catch (error) {
      console.error("Error updating scores:", error);
      setShowConfirmation(false);
    }
  };

  /** Typed entry's Cancel and the drawer's close: drops the unsaved scores. */
  const close = () => {
    setGameScores([]);
    setOriginalGameScores([]);
    setErrors([]);
    setIsUnauthorized(false);
    setSelectedSetIndex(0);
    setHasLoggedFirstPoint(false);
    snapshotRef.current = null;
    setSidesSwapped(false);
    setShowConfirmation(false);
    onClose();
  };

  /**
   * The scoreboard's back arrow. The scores stay put, so a live update still waiting on its debounce goes out; the
   * guest pages also keep a snapshot, so re-opening the same match carries on from it.
   */
  const leaveScoreboard = () => {
    snapshotRef.current =
      openInFullscreen && match ? { matchId: match.id, scores: [...gameScores], setIndex: selectedSetIndex } : null;
    setErrors([]);
    setIsUnauthorized(false);
    setSidesSwapped(false);
    setShowConfirmation(false);
    onClose();
  };

  // The switch-sides reminder (rule unchanged): every 7 points of the set on screen, until Done.
  const pointsPlayed = currentGame.homeScore + currentGame.awayScore;
  const switchReminder =
    pointsPlayed > 0 && pointsPlayed % 7 === 0 && switchCourtDismissedAt !== pointsPlayed ? pointsPlayed : null;

  /** The sets a side has won, for its "Won set N" tag: not the set on screen, nor the last one (still in play). */
  const setsWonBy = (side: Side): number[] =>
    gameScores
      .filter((_, index) => index !== selectedSetIndex && index !== gameScores.length - 1)
      .filter((score) => (side === "home" ? score.homeScore > score.awayScore : score.awayScore > score.homeScore))
      .map((score) => score.gameNumber);

  return {
    mode,
    /** What is actually shown: an expired link always falls back to typed entry, which says why. */
    surface: (isUnauthorized ? "typed" : mode) as ScoreMode,
    gameScores,
    playedGames: gameScores.filter(played),
    selectedSetIndex,
    currentGame,
    errors,
    isUnauthorized,
    sidesSwapped,
    showConfirmation,
    liveStatus,
    switchReminder,
    canAddSet,
    isBestOfOne,
    fixedPoints,
    homeName: match ? sideDisplayName(match.homeTeamName, match.homeTeam2Name) : "",
    awayName: match ? sideDisplayName(match.awayTeamName, match.awayTeam2Name) : "",
    /** "Best of 3", or "Game to 16 points" for Americano/Mexicano. */
    formatLabel: fixedPoints && match?.pointsPerMatch ? `Game to ${match.pointsPerMatch} points` : `Best of ${bestOf}`,
    bestOf,
    setsWonBy,
    selectSet: setSelectedSetIndex,
    addPoint: (side: Side) => changePoint(side, "add"),
    removePoint: (side: Side) => changePoint(side, "subtract"),
    typeScore,
    addSet,
    removeSet,
    swapSides: () => setSidesSwapped((swapped) => !swapped),
    dismissReminder: () => setSwitchCourtDismissedAt(pointsPlayed),
    showTyped: () => setMode("typed"),
    showScoreboard: () => setMode("scoreboard"),
    submit,
    cancelConfirm,
    confirmSave,
    close,
    leaveScoreboard,
  };
}

export type ScoreState = ReturnType<typeof useScoreState>;

export default useScoreState;
