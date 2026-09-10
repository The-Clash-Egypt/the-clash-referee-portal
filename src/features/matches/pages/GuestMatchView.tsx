import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import MatchCard from "../../shared/components/MatchCard";
import UpdateScoreDialog from "../components/UpdateScoreDialog";
import { MatchGameScore } from "../types/match";
import {
  GuestMatch,
  getGuestMatch,
  guestAccessErrorMessage,
  guestAccessErrorReason,
  guestMatchToMatch,
  submitGuestMatchScore,
} from "../api/matchAccess";
import { formatValidUntil } from "../../../utils/matchSheetFormat";
import "./GuestMatchPage.scss";

interface Blocked {
  title: string;
  message: string;
  tone: "error" | "neutral";
  canRetry?: boolean;
}

const INVALID: Blocked = {
  title: "Link not valid",
  message: "This link isn't valid. Ask the referee desk for a new QR code.",
  tone: "error",
};
const EXPIRED: Blocked = {
  title: "QR code expired",
  message: "This QR code has expired. Ask the referee desk for a new one.",
  tone: "error",
};
const UNREACHABLE: Blocked = {
  title: "Couldn't load this match",
  message: "Check your connection and try again.",
  tone: "neutral",
  canRetry: true,
};

const blockedFor = (error: unknown): Blocked => {
  const reason = guestAccessErrorReason(error);
  if (reason === "expired") return EXPIRED;
  if (reason === "invalid" || reason === "not-found") return INVALID;
  return UNREACHABLE;
};

/** One match reached through its QR code (spec §4.4). Final, then locked: completed matches are read-only. */
export const GuestMatchView: React.FC<{ matchId: string; token: string }> = ({ matchId, token }) => {
  const hasParams = matchId !== "" && token !== "";
  const queryClient = useQueryClient();
  const queryKey = ["guest-match", matchId, token];

  const [isScoring, setIsScoring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const { data: guestMatch, error, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => getGuestMatch(matchId, token),
    enabled: hasParams,
    retry: false,
  });

  // Memoised: UpdateScoreDialog re-initialises its scores whenever `match` changes identity.
  const match = useMemo(() => (guestMatch ? guestMatchToMatch(guestMatch) : null), [guestMatch]);

  const handleSubmit = async (gameScores: MatchGameScore[]) => {
    setSaving(true);
    try {
      const updated = await submitGuestMatchScore(matchId, token, gameScores);
      queryClient.setQueryData<GuestMatch>(queryKey, updated);
      setNotice(updated.isCompleted ? null : "Score saved.");
    } catch (submitError) {
      const reason = guestAccessErrorReason(submitError);
      if (reason === "completed" || reason === "expired" || reason === "invalid" || reason === "not-found") {
        // Nothing to retry: let the dialog close and the page say why.
        setNotice(reason === "completed" ? "This match was already completed." : null);
        await refetch();
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

  if (hasParams && isLoading) {
    return (
      <div className="guest-match-page">
        <div className="guest-match-page__loading">
          <div className="guest-match-page__spinner" />
          <p>Loading match…</p>
        </div>
      </div>
    );
  }

  const blocked = !hasParams ? INVALID : error ? blockedFor(error) : null;
  if (blocked || !guestMatch || !match) {
    const shown = blocked ?? UNREACHABLE;
    return (
      <div className="guest-match-page">
        <div className={`guest-match-page__blocked guest-match-page__blocked--${shown.tone}`}>
          <h2>{shown.title}</h2>
          <p>{shown.message}</p>
          {shown.canRetry ? (
            <button className="guest-match-page__button" onClick={() => refetch()}>
              Try again
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="guest-match-page">
      <header className="guest-match-page__header">
        <p className="guest-match-page__tournament">{guestMatch.tournamentName}</p>
        <h1>{guestMatch.venue || "Match"}</h1>
      </header>

      <main className="guest-match-page__content">
        {notice ? (
          <p className="guest-match-page__notice" role="status">
            {notice}
          </p>
        ) : null}

        <MatchCard match={match} showAdminActions={false} showUpdateScore={false} showAssignReferee={false} />

        {match.isCompleted ? (
          <p className="guest-match-page__final">
            Scores for this match are final. Contact the referee desk for corrections.
          </p>
        ) : !guestMatch.homeTeamName || !guestMatch.awayTeamName ? (
          // Same rule as the server: nobody scores a match before both teams are known.
          <p className="guest-match-page__final">
            This match's teams haven't been decided yet. Check back once the earlier rounds finish.
          </p>
        ) : (
          <>
            <button
              className="guest-match-page__button guest-match-page__button--primary"
              onClick={() => {
                setNotice(null);
                setIsScoring(true);
              }}
            >
              Enter score
            </button>
            {guestMatch.expiresAt ? (
              <p className="guest-match-page__expiry">This link works until {formatValidUntil(guestMatch.expiresAt)}.</p>
            ) : null}
          </>
        )}
      </main>

      <UpdateScoreDialog
        isOpen={isScoring && !match.isCompleted}
        match={match}
        onClose={handleDialogClose}
        onSubmit={handleSubmit}
        loading={saving}
        matchAccessToken={token}
        openInFullscreen
      />
    </div>
  );
};

export default GuestMatchView;
