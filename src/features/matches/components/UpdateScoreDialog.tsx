import React, { useState, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Match, MatchGameScore, TeamMember, isFixedPointsFormat, sideDisplayName } from "../types/match";
import { updateLiveScore } from "../api/matches";
import { cellsFromGameScores, hasAnyScore, validateGameScores } from "../../../utils/scoreValidation";
import Drawer from "../../shared/components/Drawer";
import "./UpdateScoreDialog.scss";

/** What the fullscreen back arrow leaves behind, so re-opening the same match carries on from there. */
interface ScoreSnapshot {
  matchId: string;
  scores: MatchGameScore[];
  setIndex: number;
}

interface UpdateScoreDialogProps {
  isOpen: boolean;
  match: Match | null;
  onClose: () => void;
  onSubmit: (gameScores: MatchGameScore[]) => Promise<void>;
  loading: boolean;
  venueAccessToken?: string;
  matchAccessToken?: string; // match QR guest page
  openInFullscreen?: boolean; // New prop to control fullscreen behavior
}

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
  const [gameScores, setGameScores] = useState<MatchGameScore[]>([]);
  const [originalGameScores, setOriginalGameScores] = useState<MatchGameScore[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedSetIndex, setSelectedSetIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [hasLoggedFirstPoint, setHasLoggedFirstPoint] = useState(false);
  // A ref, not state: it is read once when the dialog opens and must never re-initialise an open dialog.
  const snapshotRef = useRef<ScoreSnapshot | null>(null);
  const [wasInitiallyMobile, setWasInitiallyMobile] = useState(false);
  const [showRotateHint, setShowRotateHint] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [rotateHintDismissed, setRotateHintDismissed] = useState(false);
  const [sidesSwapped, setSidesSwapped] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [switchCourtDismissedAt, setSwitchCourtDismissedAt] = useState<number | null>(null);

  // Check if device is mobile and orientation
  useEffect(() => {
    const checkMobile = () => {
      // Check if it's a mobile/tablet device based on screen size in any orientation
      // Use the smaller dimension to determine if it's a mobile device
      const minDimension = Math.min(window.innerWidth, window.innerHeight);
      const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      const isMobileDevice =
        minDimension <= 768 || (isTouchDevice && Math.max(window.innerWidth, window.innerHeight) <= 1024);

      setIsMobile(isMobileDevice);

      // Track if it was mobile on initial load
      if (!wasInitiallyMobile && isMobileDevice) {
        setWasInitiallyMobile(true);
      }

      // Check orientation
      const isLandscapeOrientation = window.innerWidth > window.innerHeight;
      setIsLandscape(isLandscapeOrientation);

      // Hide rotate hint when in landscape
      if (isLandscapeOrientation) {
        setShowRotateHint(false);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, [wasInitiallyMobile]);

  // Auto-open fullscreen for guest venue on mobile
  useEffect(() => {
    if (isOpen && openInFullscreen && isMobile) {
      setIsFullscreen(true);
    }
  }, [isOpen, openInFullscreen, isMobile]);

  // Show rotate hint when entering fullscreen in portrait mode
  useEffect(() => {
    if (isFullscreen && !isLandscape && (isMobile || wasInitiallyMobile) && !rotateHintDismissed) {
      setShowRotateHint(true);
    } else {
      setShowRotateHint(false);
    }
  }, [isFullscreen, isLandscape, isMobile, wasInitiallyMobile, rotateHintDismissed]);

  // Whether the fullscreen scoreboard is on screen (its branch is below); an expired access link
  // falls back to the drawer, which explains it.
  const showScoreboard =
    isOpen && match !== null && isFullscreen && (isMobile || wasInitiallyMobile) && !isUnauthorized;

  // Prevent background scrolling behind the scoreboard; in modal mode the Drawer does it. Keyed on the
  // scoreboard being on screen, not on isFullscreen (still set after the expired-link fallback), so
  // the two locks never overlap: each restores what it found, and overlapping would leave the page locked.
  useEffect(() => {
    if (!showScoreboard) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showScoreboard]);

  // Initialize game scores when match changes
  useEffect(() => {
    if (match && isOpen) {
      let initialScores: MatchGameScore[] = [];

      // Guest pages: carry on from the back arrow's snapshot, but only for the match it was taken
      // from (live scoring would otherwise write it into another match). It is used up here, so a
      // later re-initialisation — e.g. the page applying a save's result — reads the match instead.
      const snapshot = snapshotRef.current;
      snapshotRef.current = null;
      if (openInFullscreen && snapshot && snapshot.matchId === match.id && snapshot.scores.length > 0) {
        initialScores = [...snapshot.scores];
        setSelectedSetIndex(snapshot.setIndex);
      } else {
        // Normal initialization
        if (match.gameScores && match.gameScores.length > 0) {
          initialScores.push(...match.gameScores);
        }

        if (initialScores.length === 0) {
          initialScores.push({
            gameNumber: 1,
            homeScore: 0,
            awayScore: 0,
          });
        }
        setSelectedSetIndex(0);
        // Reset wasInitiallyMobile when opening fresh (not preserving state)
        setWasInitiallyMobile(false);
      }

      // Americano/Mexicano matches are exactly one game — never carry extra sets
      if (isFixedPointsFormat(match.formatType)) {
        initialScores = initialScores.slice(0, 1);
      }

      setGameScores(initialScores);
      setOriginalGameScores([...initialScores]); // Store original scores for reset functionality
      setErrors([]);
      setIsUnauthorized(false);
      setHasLoggedFirstPoint(false);
    }
  }, [match, isOpen, openInFullscreen]);

  // Every open starts without a confirm prompt: a late click on the frozen Save while the drawer
  // slid out would otherwise leave one waiting for the next open.
  useEffect(() => {
    if (isOpen) setShowConfirmation(false);
  }, [isOpen]);

  // The drawer's confirm prompt (the scoreboard has its own): Confirm takes the focus when it opens,
  // and hands it back to what had it (Save) when it goes.
  const confirmTitleId = useId();
  const confirmTextId = useId();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const drawerConfirmOpen = isOpen && match !== null && showConfirmation && !showScoreboard;
  useEffect(() => {
    if (!drawerConfirmOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    confirmButtonRef.current?.focus();
    return () => {
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [drawerConfirmOpen]);

  // Send live score updates when game scores change (with debouncing)
  // Only send live score updates after the first point has been logged
  useEffect(() => {
    // Don't send live score updates if user is unauthorized
    if (isUnauthorized) return;

    // Check if any point has been logged
    const hasAnyPoints = gameScores.some((score) => score.homeScore > 0 || score.awayScore > 0);

    if (hasAnyPoints && !hasLoggedFirstPoint) {
      setHasLoggedFirstPoint(true);
    }

    // Only send live score updates after first point is logged
    if (hasLoggedFirstPoint) {
      const timeoutId = setTimeout(() => {
        sendLiveScore(gameScores);
      }, 500); // 500ms debounce

      return () => clearTimeout(timeoutId);
    }
  }, [gameScores, isUnauthorized, hasLoggedFirstPoint]);

  const getBestOfValue = (match: Match): number => {
    return match.bestOf || 1;
  };

  const canAddMoreSets = (): boolean => {
    if (!match) return false;
    if (isFixedPointsFormat(match.formatType)) return false;
    const bestOf = getBestOfValue(match);
    // For best of N, we can have up to N games
    // We can add more games if we haven't reached the maximum possible games
    // Check if match is already decided (one team has won majority of sets)
    const homeWins = gameScores.filter((score) => score.homeScore > score.awayScore).length;
    const awayWins = gameScores.filter((score) => score.homeScore < score.awayScore).length;
    const setsNeededToWin = Math.ceil(bestOf / 2);

    // If either team has already won the required number of sets, don't allow more games
    if (homeWins >= setsNeededToWin || awayWins >= setsNeededToWin) {
      return false;
    }
    return gameScores.length < bestOf;
  };

  const isBestOfOne = (match: Match): boolean => {
    return getBestOfValue(match) === 1;
  };

  // Function to send live score updates
  const sendLiveScore = async (gameScores: MatchGameScore[]) => {
    if (!match?.id) return;

    try {
      await updateLiveScore(
        {
          matchId: match.id,
          gameScores: gameScores,
        },
        { venueAccessToken, matchAccessToken }
      );
    } catch (error: any) {
      console.error("Failed to update live score:", error);

      // Check if it's a 401 unauthorized error
      if (error.response?.status === 401) {
        setIsUnauthorized(true);
        setErrors(["Your access link is invalid or has expired. Please contact the tournament organizer."]);
        // Reset scores to original values
        setGameScores([...originalGameScores]);
      } else {
        // Handle other errors
        setErrors(["Failed to update live score. Please try again."]);
      }
    }
  };

  const updateGameScore = (gameNumber: number, field: "homeScore" | "awayScore", value: string) => {
    const numericValue = value === "" ? 0 : Math.max(0, parseInt(value) || 0);
    setGameScores((prev) => {
      const updatedScores = prev.map((score) =>
        score.gameNumber === gameNumber ? { ...score, [field]: numericValue } : score
      );

      return updatedScores;
    });
  };

  const quickUpdateScore = (team: "home" | "away", action: "add" | "subtract") => {
    const currentGame = gameScores[selectedSetIndex];
    if (!currentGame) return;

    const currentScore = team === "home" ? currentGame.homeScore : currentGame.awayScore;
    const newScore = action === "add" ? currentScore + 1 : Math.max(0, currentScore - 1);

    updateGameScore(currentGame.gameNumber, `${team}Score` as "homeScore" | "awayScore", newScore.toString());
  };

  const addGame = () => {
    const nextGameNumber = gameScores.length + 1;
    setGameScores((prev) => {
      const newScores = [
        ...prev,
        {
          gameNumber: nextGameNumber,
          homeScore: 0,
          awayScore: 0,
        },
      ];

      return newScores;
    });

    // In fullscreen mode, automatically select the newly added game
    if (isFullscreen) {
      setSelectedSetIndex(nextGameNumber - 1);
    }
  };

  const removeGame = (gameNumber: number) => {
    const removedIndex = gameScores.findIndex((score) => score.gameNumber === gameNumber);
    if (removedIndex === -1) return;

    // Renumber 1..n: the server only accepts contiguous game numbers, and addGame numbers by count.
    const remaining = gameScores
      .filter((_, index) => index !== removedIndex)
      .map((score, index) => ({ ...score, gameNumber: index + 1 }));
    setGameScores(remaining);
    // Keep the fullscreen scoreboard on the same set, and never past the last one.
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

  const handleSubmit = () => {
    if (!validateScores()) {
      return;
    }
    setShowConfirmation(true);
  };

  const handleConfirmSave = async () => {
    const playedGames = gameScores.filter((score) => score.homeScore > 0 || score.awayScore > 0);

    try {
      await onSubmit(playedGames);
      setShowConfirmation(false);
      snapshotRef.current = null; // saved: nothing to carry on from
      onClose();
    } catch (error) {
      console.error("Error updating scores:", error);
      setShowConfirmation(false);
    }
  };

  const handleClose = () => {
    setGameScores([]);
    setOriginalGameScores([]);
    setErrors([]);
    setIsUnauthorized(false);
    setIsFullscreen(false);
    setSelectedSetIndex(0);
    setHasLoggedFirstPoint(false);
    snapshotRef.current = null;
    setWasInitiallyMobile(false);
    setRotateHintDismissed(false);
    setSidesSwapped(false);
    setShowConfirmation(false);
    onClose();
  };

  const handleGuestVenueClose = () => {
    // For guest venue context, preserve the current state (for this match only) but close the dialog
    snapshotRef.current = match ? { matchId: match.id, scores: [...gameScores], setIndex: selectedSetIndex } : null;
    setErrors([]);
    setIsUnauthorized(false);
    setIsFullscreen(false);
    setWasInitiallyMobile(false);
    setRotateHintDismissed(false);
    setSidesSwapped(false);
    onClose();
  };

  const exitFullscreen = () => {
    if (openInFullscreen) {
      // If opened in fullscreen mode (guest venue context), close the dialog but preserve state
      handleGuestVenueClose();
    } else {
      // Otherwise, just exit fullscreen mode
      setIsFullscreen(false);
      setWasInitiallyMobile(false);
      setRotateHintDismissed(false);
    }
  };

  // Helper function to render team members (max 3, captain indicator only if more than 3)
  const renderTeamMembers = (members: TeamMember[] | undefined, compact: boolean = false) => {
    if (!members || members.length === 0) return null;

    const displayMembers = members.slice(0, 3);
    const hasMore = members.length > 3;

    return (
      <div className={`team-members-display ${compact ? "compact" : ""}`}>
        {displayMembers.map((member, index) => (
          <span key={member.id} className="member-name">
            {member.firstName} {member.lastName}
            {hasMore && member.isCaptain && <span className="captain-badge">(C)</span>}
          </span>
        ))}
      </div>
    );
  };

  // No early `return null` when closed: in modal mode the Drawer must stay mounted to slide out.
  const homeSideName = match ? sideDisplayName(match.homeTeamName, match.homeTeam2Name) : "";
  const awaySideName = match ? sideDisplayName(match.awayTeamName, match.awayTeam2Name) : "";

  // Only count completed sets (sets that have been played)
  const completedSets = gameScores.filter((score) => score.homeScore > 0 || score.awayScore > 0);
  const homeWins = completedSets.filter((score) => score.homeScore > score.awayScore).length;
  const awayWins = completedSets.filter((score) => score.awayScore > score.homeScore).length;
  const currentGame = gameScores[selectedSetIndex] || { gameNumber: 1, homeScore: 0, awayScore: 0 };

  // Fullscreen Scoreboard View (Mobile Only)
  // Keep fullscreen open if it was opened on a mobile device, even after rotation
  if (showScoreboard && match) {
    return (
      <div className="fullscreen-scoreboard">
        <div className="scoreboard-content">
          {/* Header */}
          <div className="scoreboard-header">
            <button className="back-btn" onClick={exitFullscreen} aria-label="Back">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>

            {/* Set Selector in Header */}
            <div className="header-set-selector">
              {gameScores.map((score, index) => (
                <button
                  key={index}
                  className={`set-tab ${index === selectedSetIndex ? "active" : ""} ${
                    score.homeScore > 0 || score.awayScore > 0 ? "completed" : ""
                  }`}
                  onClick={() => setSelectedSetIndex(index)}
                >
                  Set {score.gameNumber}
                </button>
              ))}
            </div>

            {/* Switch Sides Button */}
            <button className="switch-sides-btn" onClick={() => setSidesSwapped(!sidesSwapped)} title="Switch sides">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M7 16L3 12L7 8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M3 12H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path
                  d="M17 8L21 12L17 16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Rotate Hint */}
          {showRotateHint && !isLandscape && (
            <div className="rotate-hint">
              <svg className="rotate-icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M7.5 6.5C7.5 3.46 9.96 1 13 1s5.5 2.46 5.5 5.5-2.46 5.5-5.5 5.5H3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M6 9L3 12L6 15"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Rotate device for better view</span>
              <button
                className="dismiss-hint-btn"
                onClick={() => setRotateHintDismissed(true)}
                aria-label="Dismiss hint"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )}

          {/* Scoreboard */}
          <div className="scoreboard-main">
            <div className="team-section home">
              <div className="team-name">{sidesSwapped ? awaySideName : homeSideName}</div>
              {renderTeamMembers(sidesSwapped ? match.awayTeamMembers : match.homeTeamMembers, true)}
              <div className="score-display">{sidesSwapped ? currentGame.awayScore : currentGame.homeScore}</div>
              <div className="score-controls">
                <button
                  className="score-btn add"
                  onClick={() => quickUpdateScore(sidesSwapped ? "away" : "home", "add")}
                >
                  +
                </button>
                <button
                  className="score-btn subtract"
                  onClick={() => quickUpdateScore(sidesSwapped ? "away" : "home", "subtract")}
                  disabled={sidesSwapped ? currentGame.awayScore === 0 : currentGame.homeScore === 0}
                >
                  -
                </button>
              </div>
            </div>

            {/* Switch Court Reminder - between team cards */}
            {(() => {
              const totalPoints = currentGame.homeScore + currentGame.awayScore;
              const shouldSwitch = totalPoints > 0 && totalPoints % 7 === 0;
              if (shouldSwitch && switchCourtDismissedAt !== totalPoints) {
                return (
                  <div className="switch-court-reminder">
                    <div className="switch-court-content">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M7 16L3 12L7 8"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path d="M3 12H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path
                          d="M17 8L21 12L17 16"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      <span>Switch Courts!</span>
                    </div>
                    <button
                      className="switch-court-dismiss"
                      onClick={() => setSwitchCourtDismissedAt(totalPoints)}
                      aria-label="Dismiss"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                );
              }
              return null;
            })()}

            <div className="team-section away">
              <div className="team-name">{sidesSwapped ? homeSideName : awaySideName}</div>
              {renderTeamMembers(sidesSwapped ? match.homeTeamMembers : match.awayTeamMembers, true)}
              <div className="score-display">{sidesSwapped ? currentGame.homeScore : currentGame.awayScore}</div>
              <div className="score-controls">
                <button
                  className="score-btn add"
                  onClick={() => quickUpdateScore(sidesSwapped ? "home" : "away", "add")}
                >
                  +
                </button>
                <button
                  className="score-btn subtract"
                  onClick={() => quickUpdateScore(sidesSwapped ? "home" : "away", "subtract")}
                  disabled={sidesSwapped ? currentGame.homeScore === 0 : currentGame.awayScore === 0}
                >
                  -
                </button>
              </div>
            </div>
          </div>

          {/* Match Progress */}
          {!isBestOfOne(match) && (
            <div className="match-progress">
              <div className="progress-item">
                <span className="label">{sidesSwapped ? "Away Wins" : "Home Wins"}</span>
                <span className="value">{sidesSwapped ? awayWins : homeWins}</span>
              </div>
              <div className="progress-item">
                <span className="label">Sets</span>
                <span className="value">
                  {completedSets.length}/{getBestOfValue(match)}
                </span>
              </div>
              <div className="progress-item">
                <span className="label">{sidesSwapped ? "Home Wins" : "Away Wins"}</span>
                <span className="value">{sidesSwapped ? homeWins : awayWins}</span>
              </div>
            </div>
          )}

          {/* Why a save was refused (a tie, a points mismatch, a gap) — same messages as the modal */}
          {errors.length > 0 && (
            <div className="error-messages" role="alert">
              {errors.map((error, index) => (
                <p key={index} className="error-message">
                  {error}
                </p>
              ))}
            </div>
          )}

          {/* Save Button */}
          <div className="save-section">
            {!isBestOfOne(match) && canAddMoreSets() && (
              <button className="add-game-btn" onClick={addGame}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" />
                </svg>
                Add Set {gameScores.length + 1}
              </button>
            )}
            <button className="save-btn" onClick={handleSubmit} disabled={loading}>
              {loading ? "Saving..." : "Save Scores"}
            </button>
          </div>

          {/* Confirmation Overlay */}
          {showConfirmation && (
            <div className="confirmation-overlay" onClick={() => setShowConfirmation(false)}>
              <div className="confirmation-dialog" onClick={(e) => e.stopPropagation()}>
                <h4>Confirm Save</h4>
                <p>Are you sure you want to save these scores?</p>
                <div className="confirmation-teams-summary">
                  <div className="confirmation-team home">
                    <span className="confirmation-team-name">{homeSideName}</span>
                    {match.homeTeamMembers && match.homeTeamMembers.length > 0 && (
                      <div className="confirmation-members">
                        {match.homeTeamMembers.map((m) => (
                          <span key={m.id} className="confirmation-member">
                            {m.firstName} {m.lastName}{m.isCaptain ? " (C)" : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="confirmation-vs">vs</span>
                  <div className="confirmation-team away">
                    <span className="confirmation-team-name">{awaySideName}</span>
                    {match.awayTeamMembers && match.awayTeamMembers.length > 0 && (
                      <div className="confirmation-members">
                        {match.awayTeamMembers.map((m) => (
                          <span key={m.id} className="confirmation-member">
                            {m.firstName} {m.lastName}{m.isCaptain ? " (C)" : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="confirmation-scores-summary">
                  {gameScores
                    .filter((s) => s.homeScore > 0 || s.awayScore > 0)
                    .map((s) => (
                      <div key={s.gameNumber} className="confirmation-set">
                        <span className="set-label">Set {s.gameNumber}:</span>
                        <span className="home-score">{s.homeScore}</span>
                        <span className="score-dash">-</span>
                        <span className="away-score">{s.awayScore}</span>
                      </div>
                    ))}
                </div>
                <div className="confirmation-actions">
                  <button className="btn btn-secondary" onClick={() => setShowConfirmation(false)}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={handleConfirmSave} disabled={loading}>
                    {loading ? "Saving..." : "Confirm"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Escape while the confirm prompt is up backs out of the prompt only, as a click beside it does.
  // (The prompt covers the backdrop and the close button, so Escape is the only way to reach this.)
  const closeDrawer = showConfirmation ? () => setShowConfirmation(false) : handleClose;

  // Regular Modal View: the right-side drawer. It supplies the header, close button, Escape, backdrop
  // click and scroll lock, and keeps showing its last content while it slides out.
  return (
    <>
      <Drawer
        isOpen={isOpen && match !== null}
        onClose={closeDrawer}
        title="Enter Match Scores"
        subtitle={
          match ? (
            <span className="match-info">
              <span className="best-of-badge">
                {isFixedPointsFormat(match.formatType) && match.pointsPerMatch
                  ? `Game to ${match.pointsPerMatch} points`
                  : `Best of ${getBestOfValue(match)}`}
              </span>
              {!isBestOfOne(match) && (
                <span className="sets-progress">
                  {completedSets.length} of {getBestOfValue(match)} sets completed
                </span>
              )}
              {isMobile && (
                <button
                  className="fullscreen-toggle"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFullscreen(true);
                  }}
                  title="Enter fullscreen scoreboard"
                  disabled={isUnauthorized}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="2" width="20" height="20" rx="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    <text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="bold" fill="currentColor">
                      1:0
                    </text>
                  </svg>
                </button>
              )}
            </span>
          ) : null
        }
        size="md"
        className="update-score-drawer"
        footer={
          <div className="modal-actions">
            <button
              className="btn btn-secondary"
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={(e) => {
                e.stopPropagation();
                handleSubmit();
              }}
              disabled={loading || isUnauthorized}
            >
              {loading ? "Saving..." : "Save Scores"}
            </button>
          </div>
        }
      >
        {match ? (
          <>
            {/* Sticky Teams Display */}
            <div className="sticky-teams" onClick={(e) => e.stopPropagation()}>
              <div className="dialog-teams-row">
                <div className="dialog-team-card home">
                  <span className="dialog-team-name">{homeSideName}</span>
                  {renderTeamMembers(match.homeTeamMembers)}
                </div>
                <span className="dialog-vs">vs</span>
                <div className="dialog-team-card away">
                  <span className="dialog-team-name">{awaySideName}</span>
                  {renderTeamMembers(match.awayTeamMembers)}
                </div>
              </div>
            </div>

            <div className="modal-body" onClick={(e) => e.stopPropagation()}>
              {/* Score Inputs */}
              <div className="score-inputs">
                {gameScores.map((score, index) => (
                  <div key={score.gameNumber} className="score-row">
                    <div className="set-label">Set {score.gameNumber}</div>
                    {/* Each score sits under its team's card; the set's higher score takes its team's colour */}
                    <div className="score-inputs-container">
                      <div className={`team-input home${score.homeScore > score.awayScore ? " leading" : ""}`}>
                        <input
                          type="number"
                          min="0"
                          value={score.homeScore === 0 ? "" : score.homeScore}
                          onChange={(e) => updateGameScore(score.gameNumber, "homeScore", e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="score-input"
                          placeholder="0"
                          aria-label={`${homeSideName}, set ${score.gameNumber}`}
                          disabled={isUnauthorized}
                        />
                      </div>
                      <div className="score-divider" aria-hidden="true">-</div>
                      <div className={`team-input away${score.awayScore > score.homeScore ? " leading" : ""}`}>
                        <input
                          type="number"
                          min="0"
                          value={score.awayScore === 0 ? "" : score.awayScore}
                          onChange={(e) => updateGameScore(score.gameNumber, "awayScore", e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="score-input"
                          placeholder="0"
                          aria-label={`${awaySideName}, set ${score.gameNumber}`}
                          disabled={isUnauthorized}
                        />
                      </div>
                    </div>
                    {!isBestOfOne(match) && gameScores.length > 1 && (
                      <button
                        className="remove-set-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeGame(score.gameNumber);
                        }}
                        type="button"
                        title="Remove set"
                        disabled={isUnauthorized}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Set Button */}
              {!isBestOfOne(match) && canAddMoreSets() && (
                <div className="add-set-section">
                  <button
                    className="add-set-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      addGame();
                    }}
                    type="button"
                    disabled={isUnauthorized}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" />
                    </svg>
                    Add Another Set
                  </button>
                </div>
              )}

              {errors.length > 0 && (
                <div className={`error-messages ${isUnauthorized ? "unauthorized-error" : ""}`}>
                  {errors.map((error, index) => (
                    <p key={index} className={`error-message ${isUnauthorized ? "unauthorized-message" : ""}`}>
                      {error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </Drawer>

      {/* Confirmation Overlay. Portalled beside the drawer, not inside it: inside, it would be part of
          the drawer's last frame and ride out on the slide-out after every save. */}
      {drawerConfirmOpen && match
        ? createPortal(
            <div className="confirmation-overlay" onClick={() => setShowConfirmation(false)}>
              <div
                className="confirmation-dialog"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={confirmTitleId}
                aria-describedby={confirmTextId}
                onClick={(e) => e.stopPropagation()}
              >
                <h4 id={confirmTitleId}>Confirm Save</h4>
                <p id={confirmTextId}>Are you sure you want to save these scores?</p>
                <div className="confirmation-teams-summary">
                  <div className="confirmation-team home">
                    <span className="confirmation-team-name">{homeSideName}</span>
                    {match.homeTeamMembers && match.homeTeamMembers.length > 0 && (
                      <div className="confirmation-members">
                        {match.homeTeamMembers.map((m) => (
                          <span key={m.id} className="confirmation-member">
                            {m.firstName} {m.lastName}{m.isCaptain ? " (C)" : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="confirmation-vs">vs</span>
                  <div className="confirmation-team away">
                    <span className="confirmation-team-name">{awaySideName}</span>
                    {match.awayTeamMembers && match.awayTeamMembers.length > 0 && (
                      <div className="confirmation-members">
                        {match.awayTeamMembers.map((m) => (
                          <span key={m.id} className="confirmation-member">
                            {m.firstName} {m.lastName}{m.isCaptain ? " (C)" : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="confirmation-scores-summary">
                  {gameScores
                    .filter((s) => s.homeScore > 0 || s.awayScore > 0)
                    .map((s) => (
                      <div key={s.gameNumber} className="confirmation-set">
                        <span className="set-label">Set {s.gameNumber}:</span>
                        <span className="home-score">{s.homeScore}</span>
                        <span className="score-dash">-</span>
                        <span className="away-score">{s.awayScore}</span>
                      </div>
                    ))}
                </div>
                <div className="confirmation-actions">
                  <button className="btn btn-secondary" onClick={() => setShowConfirmation(false)}>
                    Cancel
                  </button>
                  <button
                    ref={confirmButtonRef}
                    className="btn btn-primary"
                    onClick={handleConfirmSave}
                    disabled={loading}
                  >
                    {loading ? "Saving..." : "Confirm"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
};

export default UpdateScoreDialog;
