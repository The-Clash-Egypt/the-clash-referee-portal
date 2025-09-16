import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getGuestVenue, validateVenueToken } from "../api/venue";
import { VenueMatch, VenueMatchGameScore } from "../types/venue";
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

  const formatMatchTime = (startTime: string) => {
    return new Date(startTime).toLocaleString();
  };

  const getMatchStatus = (match: VenueMatch) => {
    if (match.isCompleted) {
      return "completed";
    }
    const now = new Date();
    const matchTime = new Date(match.startTime);
    const timeDiff = matchTime.getTime() - now.getTime();

    // If match starts within 30 minutes, consider it "live"
    if (timeDiff <= 30 * 60 * 1000 && timeDiff >= -2 * 60 * 60 * 1000) {
      return "live";
    }

    return "scheduled";
  };

  const getTotalScore = (match: VenueMatch, isHome: boolean) => {
    if (isHome) {
      return match.homeTeamSets;
    }
    return match.awayTeamSets;
  };

  return (
    <div className="guest-venue-page">
      <div className="guest-venue-page__header">
        <h1>{venueData.name}</h1>
      </div>

      <div className="guest-venue-page__content">
        {venueData.matches && venueData.matches.length > 0 && (
          <div className="matches-section">
            <h2>Matches</h2>
            <div className="matches-list">
              {venueData.matches
                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                .map((match) => {
                  const status = getMatchStatus(match);
                  return (
                    <div key={match.id} className="match-card">
                      <div className="match-header">
                        <span className="match-round">{match.round}</span>
                        <span className={`match-status ${status}`}>{status}</span>
                      </div>
                      <div className="match-teams">
                        <div className="team">
                          <span className="team-name">{match.homeTeamName}</span>
                          <span className="team-score">{getTotalScore(match, true)}</span>
                        </div>
                        <div className="vs">VS</div>
                        <div className="team">
                          <span className="team-name">{match.awayTeamName}</span>
                          <span className="team-score">{getTotalScore(match, false)}</span>
                        </div>
                      </div>
                      <div className="match-details">
                        <span className="match-time">{formatMatchTime(match.startTime)}</span>
                        <span className="match-venue">{match.venue}</span>
                      </div>
                      {match.gameScores && match.gameScores.length > 0 && (
                        <div className="game-scores">
                          <h4>Game Scores:</h4>
                          <div className="scores-grid">
                            {match.gameScores
                              .sort((a, b) => a.gameNumber - b.gameNumber)
                              .map((game) => (
                                <div key={game.gameNumber} className="game-score">
                                  <span>Game {game.gameNumber}:</span>
                                  <span>
                                    {game.homeScore} - {game.awayScore}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GuestVenuePage;
