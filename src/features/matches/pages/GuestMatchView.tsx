import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import UpdateScoreDialog from "../components/UpdateScoreDialog";
import { Match, MatchGameScore, isFixedPointsFormat, sideDisplayName } from "../types/match";
import {
  GuestMatch,
  getGuestMatch,
  guestAccessErrorMessage,
  guestAccessErrorReason,
  guestMatchToMatch,
  isMatchId,
  submitGuestMatchScore,
} from "../api/matchAccess";
import { formatValidUntil } from "../../../utils/matchSheetFormat";
import { formatDayLabel, formatTime, isSameLocalDay } from "../utils/timeline";
import { initials, matchWinner, playersLine, scoreCells, ScoreCell, setsWon } from "../utils/matchDisplay";
import GuestFrame from "../../shared/components/GuestFrame";
// Each primitive from its own file: the src/ui barrel pulls in react-router-dom, which this page's test can't load.
import { Button } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { Icon, IconName } from "../../../ui/Icon";
import { Spinner } from "../../../ui/Spinner";
import { Tag } from "../../../ui/Tag";
import "./GuestMatchPage.scss";

interface Blocked {
  title: string;
  message: string;
  icon: IconName;
  /** A network or server failure: worth retrying, and not a reason to hide a match already shown. */
  canRetry?: boolean;
}

const INVALID: Blocked = {
  title: "Link not valid",
  message: "This link isn't valid. Ask the referee desk for a new QR code.",
  icon: "link",
};
const EXPIRED: Blocked = {
  title: "QR code expired",
  message: "This QR code has expired. Ask the referee desk for a new one.",
  icon: "clock",
};
const UNREACHABLE: Blocked = {
  title: "Couldn't load this match",
  message: "Check your connection and try again.",
  icon: "alert",
  canRetry: true,
};
const SERVER_ERROR: Blocked = {
  title: "Couldn't load this match",
  message: "Something went wrong on our side. Please try again in a moment.",
  icon: "alert",
  canRetry: true,
};

const blockedFor = (error: unknown): Blocked => {
  const reason = guestAccessErrorReason(error);
  if (reason === "expired") return EXPIRED;
  if (reason === "invalid" || reason === "not-found") return INVALID;
  if (reason === "network") return UNREACHABLE;
  return SERVER_ERROR;
};

/** "10:30", or "Sat 12 Sep 10:30" when the match isn't today. */
const whenOf = (startTime?: string): string => {
  const time = formatTime(startTime);
  if (!time || !startTime) return "";
  return isSameLocalDay(startTime, new Date()) ? time : `${formatDayLabel(startTime)} ${time}`;
};

/** When, category, stage, round and length, as the old match card listed them (the court is the bar's title). */
const contextLine = (match: Match): string =>
  [
    whenOf(match.startTime),
    match.categoryName,
    match.format,
    match.round,
    !isFixedPointsFormat(match.formatType) && match.bestOf ? `Best of ${match.bestOf}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

/** A finished points game (or a result without sets) is the result itself; finished sets are quiet. */
const cellLook = (cell: ScoreCell): string =>
  cell.state === "final" && (cell.key === "points" || cell.key === "result") ? "result" : cell.state;

/**
 * The match on its own page, like the match sheet: when and what, both sides with their players and scores, and the
 * referee teams (names only: the guest payload carries no people).
 */
const GuestMatchCard: React.FC<{ match: Match }> = ({ match }) => {
  const cells = scoreCells(match);
  const winner = matchWinner(match);
  const won = match.isCompleted ? setsWon(match) : null;
  const context = contextLine(match);
  const refereeTeams = match.refereeTeams ?? [];

  const side = (key: "home" | "away") => {
    const name =
      key === "home"
        ? sideDisplayName(match.homeTeamName, match.homeTeam2Name)
        : sideDisplayName(match.awayTeamName, match.awayTeam2Name);
    const players = playersLine(key === "home" ? match.homeTeamMembers : match.awayTeamMembers);
    const look = winner === key ? " guest-match__team--win" : winner ? " guest-match__team--lose" : "";
    return (
      <div className={`guest-match__team${look}`}>
        <div className="guest-match__who">
          <b className="guest-match__name">{name}</b>
          {players ? <small className="guest-match__players">{players}</small> : null}
        </div>
        {cells.length > 0 ? (
          <div className="guest-match__scores">
            {cells.map((cell) => (
              <span key={cell.key} className={`guest-match__score guest-match__score--${cellLook(cell)}`}>
                {cell[key]}
              </span>
            ))}
            {won && cells[0]?.key !== "result" ? (
              <span className="guest-match__score guest-match__score--won">{won[key]}</span>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <article className="guest-match__card">
      {match.isCompleted || context ? (
        <div className="guest-match__eyebrow">
          {match.isCompleted ? <Tag tone="ok">Completed</Tag> : null}
          {context ? <span className="guest-match__context">{context}</span> : null}
        </div>
      ) : null}
      <div className="guest-match__teams">
        {side("home")}
        {side("away")}
      </div>
      {refereeTeams.length > 0 ? (
        // `referees-section` / `section-title` are the hooks GuestMatchView.test.tsx reads.
        <section className="guest-match__referees referees-section" aria-labelledby="guest-match-referees">
          <h2 className="guest-match__label section-title" id="guest-match-referees">
            {refereeTeams.length === 1 ? "Referee team" : "Referee teams"}
          </h2>
          <ul className="guest-match__list">
            {refereeTeams.map((team) => (
              <li key={team.teamId} className="guest-match__referee">
                <span className="guest-match__avatar" aria-hidden="true">
                  {initials(team.teamName)}
                </span>
                <span className="guest-match__referee-name">{team.teamName}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
};

/** One match reached through its QR code (spec §4.4). Final, then locked: completed matches are read-only. */
export const GuestMatchView: React.FC<{ matchId: string; token: string }> = ({ matchId, token }) => {
  const isWellFormedLink = isMatchId(matchId) && token !== "";
  const queryClient = useQueryClient();
  const queryKey = ["guest-match", matchId, token];

  const [isScoring, setIsScoring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const { data: guestMatch, error, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: () => getGuestMatch(matchId, token),
    enabled: isWellFormedLink,
    retry: false,
    // No background refetch while the score dialog is open, so an unlock/reconnect mid-entry
    // can't swap `guestMatch`'s identity out from under UpdateScoreDialog and reset its state.
    // Freshness returns as soon as it closes.
    refetchOnWindowFocus: !isScoring,
    refetchOnReconnect: !isScoring,
  });

  // Memoised: UpdateScoreDialog re-initialises its scores whenever `match` changes identity.
  const match = useMemo(() => (guestMatch ? guestMatchToMatch(guestMatch) : null), [guestMatch]);

  // A scan should land on the scoreboard, not on a card (user request). Once per visit, so closing
  // the scoreboard shows the card and "Enter score" instead of snapping back open.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current || !guestMatch) return;
    if (guestMatch.isCompleted || !guestMatch.homeTeamName || !guestMatch.awayTeamName) return;
    autoOpened.current = true;
    setIsScoring(true);
  }, [guestMatch]);

  const handleSubmit = async (gameScores: MatchGameScore[]) => {
    setSaving(true);
    try {
      const updated = await submitGuestMatchScore(matchId, token, gameScores);
      queryClient.setQueryData<GuestMatch>(queryKey, updated);
      setNotice(updated.isCompleted ? null : "Score saved.");
    } catch (submitError) {
      const reason = guestAccessErrorReason(submitError);
      if (reason === "completed" || reason === "expired" || reason === "invalid" || reason === "not-found") {
        // Nothing to retry: let the dialog close (onSubmit resolves) and handleDialogClose refetch.
        setNotice(reason === "completed" ? "This match was already completed." : null);
        return;
      }
      alert(guestAccessErrorMessage(submitError) ?? "Couldn't save the score. Please try again.");
      throw submitError; // keeps UpdateScoreDialog open so nothing typed is lost
    } finally {
      setSaving(false);
    }
  };

  const handleDialogClose = () => {
    setIsScoring(false);
    void refetch(); // pick up live scores logged while the dialog was open
  };

  // The first load and every "Try again" with nothing on screen yet — so a retry always shows it's working.
  if (isWellFormedLink && isFetching && !guestMatch) {
    return (
      <GuestFrame narrow>
        <Spinner size={32} label="Loading match…" />
      </GuestFrame>
    );
  }

  // An expired or invalid link always blocks. A network or server failure only blocks when there is
  // nothing to show yet; a failed refresh keeps the match on screen with a notice instead.
  const failure = error ? blockedFor(error) : null;
  const blocked = !isWellFormedLink ? INVALID : failure && (!failure.canRetry || !guestMatch) ? failure : null;
  const refreshFailed = failure !== null && blocked === null;

  if (blocked || !guestMatch || !match) {
    const shown = blocked ?? UNREACHABLE;
    return (
      <GuestFrame narrow>
        <EmptyState
          icon={shown.icon}
          title={shown.title}
          body={shown.message}
          action={shown.canRetry ? <Button onClick={() => refetch()}>Try again</Button> : undefined}
        />
      </GuestFrame>
    );
  }

  return (
    <GuestFrame eyebrow={guestMatch.tournamentName} title={guestMatch.venue || "Match"} narrow>
      <div className="guest-match">
        {notice ? (
          <p className="guest-match__notice" role="status">
            {notice}
          </p>
        ) : null}
        {refreshFailed ? (
          <p className="guest-match__notice guest-match__notice--warning" role="status">
            Couldn't refresh this match, so these may not be the latest scores.
          </p>
        ) : null}

        <GuestMatchCard match={match} />

        {match.isCompleted ? (
          <p className="guest-match__final">
            <Icon name="lock" size={17} />
            Scores for this match are final. Contact the referee desk for corrections.
          </p>
        ) : !guestMatch.homeTeamName || !guestMatch.awayTeamName ? (
          // Same rule as the server: nobody scores a match before both teams are known.
          <p className="guest-match__final">
            <Icon name="clock" size={17} />
            This match's teams haven't been decided yet. Check back once the earlier rounds finish.
          </p>
        ) : (
          <>
            <Button
              size="lg"
              block
              icon="plus"
              className="guest-match__score-btn"
              onClick={() => {
                setNotice(null);
                setIsScoring(true);
              }}
            >
              Enter score
            </Button>
            {guestMatch.expiresAt ? (
              <p className="guest-match__expiry">This link works until {formatValidUntil(guestMatch.expiresAt)}.</p>
            ) : null}
          </>
        )}
      </div>

      <UpdateScoreDialog
        isOpen={isScoring && !match.isCompleted}
        match={match}
        onClose={handleDialogClose}
        onSubmit={handleSubmit}
        loading={saving}
        matchAccessToken={token}
        openInFullscreen
      />
    </GuestFrame>
  );
};

export default GuestMatchView;
