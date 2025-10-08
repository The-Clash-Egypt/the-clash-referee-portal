import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getGuestVenue, validateVenueToken } from "../api/venue";
import { VenueMatch, VenueMatchGameScore } from "../types/venue";
import MatchCard from "../../shared/components/MatchCard";
import { Match, MatchGameScore } from "../../matches/types/match";
import UpdateScoreDialog from "../../matches/components/UpdateScoreDialog";
import { updateGroupMatch, updateLeagueMatch, updateKnockoutMatch } from "../../matches/api/matches";
import "./GuestVenuePage.scss";

const GuestVenuePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const venueId = searchParams.get("venueId");
  const accessToken = searchParams.get("token");
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState<string>("");
  const [isPasswordValid, setIsPasswordValid] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const validationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Score update modal state
  const [showUpdateScoreModal, setShowUpdateScoreModal] = useState(false);
  const [selectedMatchForScore, setSelectedMatchForScore] = useState<Match | null>(null);
  const [updatingScore, setUpdatingScore] = useState(false);

  // Convert VenueMatch to Match format for MatchCard compatibility
  const convertVenueMatchToMatch = (venueMatch: VenueMatch): Match => {
    const gameScores: MatchGameScore[] = venueMatch.gameScores.map((game) => ({
      gameNumber: game.gameNumber,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
    }));

    return {
      id: venueMatch.id,
      venue: venueMatch.venue,
      tournamentName: undefined, // Don't show tournament name in guest venue
      categoryName: venueMatch.categoryName, // Default category for venue matches
      format: venueMatch.formatName ? venueMatch.formatName : venueMatch.formatType, // Not available in VenueMatch
      bestOf: venueMatch.bestOf,
      startTime: venueMatch.startTime,
      round: venueMatch.round,
      homeTeamId: venueMatch.homeTeamId,
      homeTeamName: venueMatch.homeTeamName,
      awayTeamId: venueMatch.awayTeamId,
      awayTeamName: venueMatch.awayTeamName,
      homeScore: venueMatch.homeTeamSets,
      awayScore: venueMatch.awayTeamSets,
      gameScores: gameScores,
      referees: [], // Not available in VenueMatch
      homeTeamMembers: [], // Not available in VenueMatch
      awayTeamMembers: [], // Not available in VenueMatch
      isCompleted: venueMatch.isCompleted,
    };
  };

  // Handle update score
  const handleUpdateScore = (match: Match) => {
    setSelectedMatchForScore(match);
    setShowUpdateScoreModal(true);
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

      // Call API to update match scores based on format
      if (selectedMatchForScore.format === "Group") {
        await updateGroupMatch(selectedMatchForScore.id, { gameScores });
      } else if (selectedMatchForScore.format === "League") {
        await updateLeagueMatch(selectedMatchForScore.id, { gameScores });
      } else if (selectedMatchForScore.format === "Knockout") {
        await updateKnockoutMatch(selectedMatchForScore.id, { gameScores });
      }

      // Refresh venue data to show updated scores
      if (venueId) {
        // Refetch the venue data to get updated scores
        await refetchVenueData();
      }

      setShowUpdateScoreModal(false);
      setSelectedMatchForScore(null);
    } catch (error: any) {
      console.error("Error updating scores:", error);
      alert("Failed to update scores. Please try again.");
    } finally {
      setUpdatingScore(false);
    }
  };

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

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (validationIntervalRef.current) {
        clearInterval(validationIntervalRef.current);
      }
    };
  }, []);

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
      <div className="guest-venue-page">
        <div className="guest-venue-page__loading">
          <div className="loading-spinner"></div>
          <p>{isTokenValidating ? "Validating access token..." : "Loading venue information..."}</p>
        </div>
      </div>
    );
  }

  if (error || !isTokenValid || !venueData) {
    return (
      <div className="guest-venue-page">
        <div className="guest-venue-page__error">
          <div className="error-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z" />
            </svg>
          </div>
          <h2>
            {tokenMessage === "Token has expired"
              ? "Token Expired"
              : tokenMessage === "Invalid token"
              ? "Invalid Token"
              : "Access Denied"}
          </h2>
          <p>{error}</p>
          {tokenMessage === "Token has expired" && (
            <p className="expired-message">
              Your access token has expired. Please contact the venue administrator for a new link.
            </p>
          )}
          <button className="retry-button" onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Check if venue is locked
  if (venueData.isLocked) {
    return (
      <div className="guest-venue-page">
        <div className="guest-venue-page__header">
          <h2 className="tournament-name">{venueData.tournamentName}</h2>
          <h1>{venueData.name}</h1>
        </div>
        <div className="guest-venue-page__content">
          <div className="venue-locked">
            <div className="locked-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z" />
              </svg>
            </div>
            <h2>Venue is Currently Locked</h2>
            <p>This venue is currently locked and matches are not available for viewing.</p>
            <p>Please contact the venue administrator for more information.</p>
          </div>
        </div>
      </div>
    );
  }

  // Show password prompt if password is required
  if (shouldShowPasswordPrompt) {
    return (
      <div className="guest-venue-page">
        <div className="guest-venue-page__header">
          <h2 className="tournament-name">{venueData.tournamentName}</h2>
          <h1>{venueData.name}</h1>
        </div>
        <div className="guest-venue-page__content">
          <div className="password-prompt">
            <div className="password-prompt__icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z" />
              </svg>
            </div>
            <h2>Password Required</h2>
            <p>This venue requires a password to view matches.</p>
            <form onSubmit={handlePasswordSubmit} className="password-prompt__form">
              <div className="password-prompt__input-group">
                <input
                  type="password"
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="Enter venue password"
                  className="password-prompt__input"
                  autoFocus
                />
                <button type="submit" className="password-prompt__button">
                  Access Matches
                </button>
              </div>
              {passwordError && (
                <div className="password-prompt__error">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z" />
                  </svg>
                  {passwordError}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="guest-venue-page">
      <div className="guest-venue-page__header">
        <h2 className="tournament-name">{venueData.tournamentName}</h2>
        <h1>{venueData.name}</h1>
      </div>

      <div className="guest-venue-page__content">
        {venueData.matches && venueData.matches.length > 0 && (
          <div className="matches-section">
            <h2>Matches</h2>
            <div className="matches-grid">
              {venueData.matches
                .sort((a, b) => {
                  // Always prioritize upcoming matches first
                  if (a.isCompleted && !b.isCompleted) {
                    return 1; // a (completed) comes after b (upcoming)
                  }
                  if (!a.isCompleted && b.isCompleted) {
                    return -1; // a (upcoming) comes before b (completed)
                  }
                  // If both have same completion status, sort by start time
                  return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
                })
                .map((venueMatch) => {
                  const match = convertVenueMatchToMatch(venueMatch);
                  return (
                    <MatchCard
                      key={match.id}
                      match={match}
                      onUpdateScore={handleUpdateScore}
                      showAdminActions={false}
                      showUpdateScore={!match.isCompleted}
                      showAssignReferee={false}
                      isSelectable={false}
                    />
                  );
                })}
            </div>
          </div>
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
    </div>
  );
};

export default GuestVenuePage;
