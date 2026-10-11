import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { describeRequestError } from "../../../api/errors";
import { courtAccessDenial, openCourt, submitCourtScore } from "../api/venue";
import { CourtAccessReason } from "../types/venue";
import { venueMatchToMatch } from "../utils/toMatch";
import { Match, MatchGameScore } from "../../matches/types/match";
import UpdateScoreDialog from "../../matches/components/UpdateScoreDialog";
import MatchRow from "../../matches/components/timeline/MatchRow";
import { formatDayLabel, groupMatchesBySlot, TimelineGroup } from "../../matches/utils/timeline";
import GuestFrame from "../../shared/components/GuestFrame";
import { Button } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { Icon } from "../../../ui/Icon";
import { Spinner } from "../../../ui/Spinner";
import { useToast } from "../../../ui/Toast";
import "./GuestVenuePage.scss";

const FINAL_SCORES = "Scores for this match are final. Contact the referee desk for corrections.";
const WRONG_PASSWORD = "Incorrect password. Please try again.";
const RECHECK_MS = 300000; // the link (expiry, lock) is re-checked every 5 minutes, as before

/** The refusals the password form answers; every other one blocks the page. */
const PASSWORD_REASONS: CourtAccessReason[] = ["password-required", "wrong-password"];

/**
 * A refused final save that retrying can't fix — the match is final or moved, or the court access is gone: the
 * scoreboard closes and the court is reloaded, which shows why. Anything else keeps the scoreboard open.
 */
const CLOSES_SCOREBOARD: CourtAccessReason[] = [
  "completed",
  "wrong-court",
  "not-found",
  "invalid",
  "expired",
  "locked",
  "password-required",
  "wrong-password",
];

interface CourtNames {
  name?: string | null;
  tournamentName?: string | null;
}

interface CourtSection {
  key: "next" | "done";
  title: string;
  count: number;
  groups: TimelineGroup[];
}

/** Whether the court's matches fall on more than one day: the time headers then name the day. */
const spansSeveralDays = (matches: Match[]): boolean =>
  new Set(matches.map((match) => (match.startTime ? formatDayLabel(match.startTime) : "")).filter(Boolean)).size > 1;

/**
 * The court's matches as the timeline groups them: the open ones first, in time order (what the scorekeeper plays
 * next), then the finished ones, newest first (as on the matches screen's Up next and Done).
 */
const courtSections = (matches: Match[]): CourtSection[] => {
  const showDates = spansSeveralDays(matches);
  const open = matches.filter((match) => !match.isCompleted);
  const done = matches.filter((match) => match.isCompleted);
  const sections: CourtSection[] = [
    { key: "next", title: "Up next", count: open.length, groups: groupMatchesBySlot(open, { showDates, descending: false }) },
    { key: "done", title: "Done", count: done.length, groups: groupMatchesBySlot(done, { showDates, descending: true }) },
  ];
  return sections.filter((section) => section.count > 0);
};

/**
 * The public court page (/venue/shared?venueId=&token=), opened from a court's printed QR code: the court's matches as
 * timeline rows; tapping an open one opens the scoreboard with the court's access token. The server checks the token,
 * the court's lock and its optional password (POST /venue/{id}/access, again every 5 minutes) — the page never gets
 * the court's password or token — and final scores go to the court's own score endpoint with the token and password.
 */
const GuestVenuePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const venueId = searchParams.get("venueId");
  const accessToken = searchParams.get("token");
  const hasLink = !!(venueId && accessToken);
  const toast = useToast();
  const [password, setPassword] = useState<string>("");
  // The password last sent for the server to check; `attempt` makes re-sending the same one a new check.
  const [sentPassword, setSentPassword] = useState<string | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const [passwordEdited, setPasswordEdited] = useState(false);
  const [passwordHint, setPasswordHint] = useState<string | null>(null);
  // The court as the last password refusal named it: keeps the form up while the next password is checked.
  const [gate, setGate] = useState<CourtNames | null>(null);

  // Score update modal state
  const [showUpdateScoreModal, setShowUpdateScoreModal] = useState(false);
  const [selectedMatchForScore, setSelectedMatchForScore] = useState<Match | null>(null);
  const [updatingScore, setUpdatingScore] = useState(false);

  const {
    data: venueData,
    error: courtError,
    isLoading,
    isFetching,
    refetch: refetchVenueData,
  } = useQuery({
    queryKey: ["guest-court", venueId, accessToken, sentPassword ?? null, attempt],
    queryFn: () => openCourt(venueId!, accessToken!, sentPassword),
    enabled: hasLink,
    retry: false,
    refetchInterval: (query) => (query.state.data ? RECHECK_MS : false),
  });

  const denial = courtError ? courtAccessDenial(courtError) : null;
  const asksForPassword = denial !== null && PASSWORD_REASONS.includes(denial.reason);

  const denialReason = denial?.reason;
  const denialName = denial?.name;
  const denialTournament = denial?.tournamentName;
  useEffect(() => {
    if (denialReason && PASSWORD_REASONS.includes(denialReason)) {
      setGate({ name: denialName, tournamentName: denialTournament });
    }
  }, [denialReason, denialName, denialTournament]);

  const sections = useMemo(() => courtSections((venueData?.matches ?? []).map(venueMatchToMatch)), [venueData]);

  // Handle update score
  const handleUpdateScore = (match: Match) => {
    setSelectedMatchForScore(match);
    setShowUpdateScoreModal(true);
  };

  // A finished match stays read-only here, as before: it never offered score entry.
  const handleOpenMatch = (match: Match) => {
    if (match.isCompleted) {
      toast.show(FINAL_SCORES, { tone: "info" });
      return;
    }
    handleUpdateScore(match);
  };

  // Handle scoreboard close - refetch data to show updated scores
  const handleScoreboardClose = async () => {
    setShowUpdateScoreModal(false);
    setSelectedMatchForScore(null);
    // Refetch venue data to show any live score updates
    await refetchVenueData();
  };

  // The final score goes to the court's own endpoint (scores only), with the court's token and password.
  const handleSubmitScore = async (gameScores: MatchGameScore[]) => {
    if (!selectedMatchForScore || !venueId || !accessToken) return;

    try {
      setUpdatingScore(true);

      await submitCourtScore(
        venueId,
        selectedMatchForScore.id,
        { token: accessToken, password: venueData?.requiresPassword ? sentPassword : undefined },
        gameScores
      );

      // Refresh the court to show the saved scores
      await refetchVenueData();

      setShowUpdateScoreModal(false);
      setSelectedMatchForScore(null);
    } catch (error: unknown) {
      const refused = courtAccessDenial(error);
      if (refused && CLOSES_SCOREBOARD.includes(refused.reason)) {
        toast.show(refused.reason === "completed" ? FINAL_SCORES : refused.message || "This score couldn't be saved.", {
          tone: refused.reason === "completed" ? "info" : "error",
        });
        setShowUpdateScoreModal(false);
        setSelectedMatchForScore(null);
        void refetchVenueData();
        return;
      }
      // Never the error itself: its config carries the court token and password headers.
      console.error("Error updating scores:", describeRequestError(error));
      alert(refused?.message || "Failed to update scores. Please try again.");
      throw error; // keeps UpdateScoreDialog open so nothing typed is lost
    } finally {
      setUpdatingScore(false);
    }
  };

  // The password goes to the server, which says whether it is right.
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const typed = password.trim();
    if (!typed) {
      setPasswordHint("Please enter the court's password.");
      return;
    }
    setPasswordHint(null);
    setPasswordEdited(false);
    setPassword("");
    setSentPassword(typed);
    setAttempt((count) => count + 1);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    setPasswordEdited(true);
    setPasswordHint(null);
  };

  if (!hasLink) {
    return (
      <GuestFrame narrow>
        <EmptyState
          icon="alert"
          title="Access Denied"
          body={<p className="guest-venue__line">Invalid venue link. Please check the URL and try again.</p>}
          action={<Button onClick={() => window.location.reload()}>Try Again</Button>}
        />
      </GuestFrame>
    );
  }

  // Show the password form while the court asks for one, and while a typed password is being checked
  const checkingPassword = gate !== null && !venueData && isFetching;
  if (asksForPassword || checkingPassword) {
    const names = asksForPassword ? denial : gate;
    const passwordError =
      passwordHint ?? (denial?.reason === "wrong-password" && !passwordEdited && !isFetching ? WRONG_PASSWORD : null);
    return (
      <GuestFrame eyebrow={names?.tournamentName ?? undefined} title={names?.name ?? undefined} narrow>
        <div className="guest-venue__gate-card">
          <EmptyState
            icon="lock"
            title="Password Required"
            body="This venue requires a password to view matches."
            action={
              <form onSubmit={handlePasswordSubmit} className="guest-venue__gate">
                <label className={`guest-venue__password${passwordError ? " guest-venue__password--error" : ""}`}>
                  <Icon name="lock" size={16} className="guest-venue__password-icon" />
                  <input
                    type="password"
                    value={password}
                    onChange={handlePasswordChange}
                    placeholder="Enter venue password"
                    aria-label="Enter venue password"
                    aria-invalid={passwordError ? true : undefined}
                    aria-describedby={passwordError ? "guest-venue-password-error" : undefined}
                    className="guest-venue__password-input"
                    autoFocus
                  />
                </label>
                {passwordError ? (
                  <p className="guest-venue__error" id="guest-venue-password-error" role="alert">
                    <Icon name="alert" size={15} />
                    {passwordError}
                  </p>
                ) : null}
                <Button type="submit" size="lg" block loading={isFetching}>
                  Access Matches
                </Button>
              </form>
            }
          />
        </div>
      </GuestFrame>
    );
  }

  if (isLoading) {
    return (
      <GuestFrame narrow>
        <Spinner size={32} label="Validating access token..." />
      </GuestFrame>
    );
  }

  // A locked court: named, but without its matches
  if (denial?.reason === "locked") {
    return (
      <GuestFrame eyebrow={denial.tournamentName ?? undefined} title={denial.name ?? undefined} narrow>
        <EmptyState
          icon="lock"
          title="Venue is Currently Locked"
          body={
            <>
              <p className="guest-venue__line">
                This venue is currently locked and matches are not available for viewing.
              </p>
              <p className="guest-venue__line">Please contact the venue administrator for more information.</p>
            </>
          }
        />
      </GuestFrame>
    );
  }

  // An expired or invalid link always blocks; a failed refresh keeps the court on screen.
  if (denial || !venueData) {
    const expired = denial?.reason === "expired";
    const message = expired
      ? null
      : denial
        ? denial.message || "Access token is invalid or has expired."
        : "Failed to load venue information. Please check your connection and try again.";
    return (
      <GuestFrame narrow>
        <EmptyState
          icon={expired ? "clock" : "alert"}
          title={expired ? "Token Expired" : denial?.reason === "invalid" ? "Invalid Token" : "Access Denied"}
          body={
            <>
              {message ? <p className="guest-venue__line">{message}</p> : null}
              {expired ? (
                <p className="guest-venue__line">
                  Your access token has expired. Please contact the venue administrator for a new link.
                </p>
              ) : null}
            </>
          }
          action={<Button onClick={() => window.location.reload()}>Try Again</Button>}
        />
      </GuestFrame>
    );
  }

  return (
    <GuestFrame eyebrow={venueData.tournamentName} title={venueData.name}>
      <div className="guest-venue">
        {sections.length === 0 ? (
          <div className="guest-venue__empty">
            <EmptyState icon="matches" title="No matches found" />
          </div>
        ) : (
          sections.map((section) => (
            <section
              key={section.key}
              className="guest-venue__section"
              aria-labelledby={`guest-venue-${section.key}`}
            >
              <h2 className="guest-venue__heading" id={`guest-venue-${section.key}`}>
                <span className="guest-venue__blade" aria-hidden="true" />
                {section.title}{" "}
                <span className="guest-venue__count">{section.count}</span>
              </h2>
              {section.groups.map((group) => (
                <div key={group.key} className="guest-venue__group">
                  <h3 className="guest-venue__slot">
                    <b>{group.label}</b>
                    {group.dateLabel ? (
                      <>
                        {" "}
                        <span className="guest-venue__date">{group.dateLabel}</span>
                      </>
                    ) : null}
                  </h3>
                  <ul className="guest-venue__rows">
                    {group.matches.map((match) => (
                      <li
                        key={match.id}
                        className={`guest-venue__item${match.isCompleted ? " guest-venue__item--final" : ""}`}
                      >
                        <MatchRow match={match} onOpen={handleOpenMatch} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))
        )}
      </div>

      {/* Update Score Modal */}
      <UpdateScoreDialog
        isOpen={showUpdateScoreModal}
        match={selectedMatchForScore}
        onClose={handleScoreboardClose}
        onSubmit={handleSubmitScore}
        loading={updatingScore}
        venueAccessToken={accessToken || undefined}
        venuePassword={venueData?.requiresPassword ? sentPassword : undefined}
        openInFullscreen={true}
      />
    </GuestFrame>
  );
};

export default GuestVenuePage;
