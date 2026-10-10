import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getGuestVenue, validateVenueToken } from "../api/venue";
import { venueMatchToMatch } from "../utils/toMatch";
import { Match, MatchGameScore } from "../../matches/types/match";
import UpdateScoreDialog from "../../matches/components/UpdateScoreDialog";
import MatchRow from "../../matches/components/timeline/MatchRow";
import { formatDayLabel, groupMatchesBySlot, TimelineGroup } from "../../matches/utils/timeline";
import { UnknownMatchFormatError, updateMatchByFormat } from "../../matches/api/matches";
import GuestFrame from "../../shared/components/GuestFrame";
import { Button } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { Icon } from "../../../ui/Icon";
import { Spinner } from "../../../ui/Spinner";
import { useToast } from "../../../ui/Toast";
import "./GuestVenuePage.scss";

const FINAL_SCORES = "Scores for this match are final. Contact the referee desk for corrections.";

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
 * timeline rows; tapping an open one opens the scoreboard with the court's access token. Behind it: the token check
 * (every 5 minutes), the court's lock and its optional password.
 */
const GuestVenuePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const venueId = searchParams.get("venueId");
  const accessToken = searchParams.get("token");
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState<string>("");
  const [isPasswordValid, setIsPasswordValid] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Score update modal state
  const [showUpdateScoreModal, setShowUpdateScoreModal] = useState(false);
  const [selectedMatchForScore, setSelectedMatchForScore] = useState<Match | null>(null);
  const [updatingScore, setUpdatingScore] = useState(false);

  // Token validation query
  const {
    data: tokenValidationResponse,
    isLoading: isTokenValidating,
    error: tokenValidationError,
  } = useQuery({
    queryKey: ["validate-token", venueId, accessToken],
    queryFn: () => validateVenueToken(venueId!, accessToken!),
    enabled: !!(venueId && accessToken),
    retry: false,
    refetchInterval: 300000, // Check every 5 minutes
  });

  // Venue data query (only runs if token is valid)
  const {
    data: venueResponse,
    isLoading: isVenueLoading,
    error: venueError,
    refetch: refetchVenueData,
  } = useQuery({
    queryKey: ["guest-venue", venueId, accessToken],
    queryFn: () => getGuestVenue(venueId!),
    enabled: !!(venueId && accessToken && tokenValidationResponse?.data.data === true),
    retry: false,
  });

  const venueData = venueResponse?.data.data;
  const isTokenValid = tokenValidationResponse?.data.data === true;
  const tokenMessage = tokenValidationResponse?.data.message;

  // Check if password is required and validate it
  const requiresPassword = venueData?.password && venueData.password.trim() !== "";
  const shouldShowPasswordPrompt = requiresPassword && !isPasswordValid;

  const sections = useMemo(() => courtSections((venueData?.matches ?? []).map(venueMatchToMatch)), [venueData]);

  useEffect(() => {
    if (!venueId || !accessToken) {
      setError("Invalid venue link. Please check the URL and try again.");
    }
  }, [venueId, accessToken]);

  useEffect(() => {
    if (tokenValidationError) {
      setError("Failed to validate access token. Please check your connection and try again.");
    } else if (tokenValidationResponse && !isTokenValid) {
      setError(tokenMessage || "Access token is invalid or has expired.");
    } else if (venueError) {
      setError("Failed to load venue information. Please try again.");
    }
  }, [tokenValidationError, tokenValidationResponse, isTokenValid, tokenMessage, venueError]);

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

  // Handle score submission
  const handleSubmitScore = async (gameScores: MatchGameScore[]) => {
    if (!selectedMatchForScore) return;

    try {
      setUpdatingScore(true);

      await updateMatchByFormat(selectedMatchForScore.formatType, selectedMatchForScore.id, { gameScores });

      // Refresh venue data to show updated scores
      if (venueId) {
        // Refetch the venue data to get updated scores
        await refetchVenueData();
      }

      setShowUpdateScoreModal(false);
      setSelectedMatchForScore(null);
    } catch (error: any) {
      if (error instanceof UnknownMatchFormatError) {
        // Never close the modal as if saved (silent data loss): rejecting keeps UpdateScoreDialog open.
        alert(`${error.message} Please contact the tournament organizer.`);
        throw error;
      }
      console.error("Error updating scores:", error);
      alert("Failed to update scores. Please try again.");
    } finally {
      setUpdatingScore(false);
    }
  };

  // Handle password validation
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!venueData?.password) {
      setPasswordError("No password required for this venue.");
      return;
    }

    if (password.trim() === venueData.password) {
      setIsPasswordValid(true);
      setPasswordError(null);
    } else {
      setPasswordError("Incorrect password. Please try again.");
      setPassword("");
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (passwordError) {
      setPasswordError(null);
    }
  };

  if (isTokenValidating || isVenueLoading) {
    return (
      <GuestFrame narrow>
        <Spinner size={32} label={isTokenValidating ? "Validating access token..." : "Loading venue information..."} />
      </GuestFrame>
    );
  }

  if (error || !isTokenValid || !venueData) {
    const expired = tokenMessage === "Token has expired";
    return (
      <GuestFrame eyebrow={venueData?.tournamentName} title={venueData?.name} narrow>
        <EmptyState
          icon={expired ? "clock" : "alert"}
          title={expired ? "Token Expired" : tokenMessage === "Invalid token" ? "Invalid Token" : "Access Denied"}
          body={
            error || expired ? (
              <>
                {error ? <p className="guest-venue__line">{error}</p> : null}
                {expired ? (
                  <p className="guest-venue__line">
                    Your access token has expired. Please contact the venue administrator for a new link.
                  </p>
                ) : null}
              </>
            ) : undefined
          }
          action={<Button onClick={() => window.location.reload()}>Try Again</Button>}
        />
      </GuestFrame>
    );
  }

  // Check if venue is locked
  if (venueData.isLocked) {
    return (
      <GuestFrame eyebrow={venueData.tournamentName} title={venueData.name} narrow>
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

  // Show password prompt if password is required
  if (shouldShowPasswordPrompt) {
    return (
      <GuestFrame eyebrow={venueData.tournamentName} title={venueData.name} narrow>
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
                <Button type="submit" size="lg" block>
                  Access Matches
                </Button>
              </form>
            }
          />
        </div>
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
        openInFullscreen={true}
      />
    </GuestFrame>
  );
};

export default GuestVenuePage;
