import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Match, MatchFilters } from "../types/match";
import { getRefereeMatches } from "../api/matches";
import { buildMatchAccessUrl, issueMatchAccessTokens } from "../api/matchAccess";
import { QrLinks, QrStatus } from "../../../utils/matchSheetLayout";
import PrintableView from "../components/PrintableView";
import VolleyballLoading from "../../../components/VolleyballLoading";
import "./PrintableViewPage.scss";

const PrintableViewPage: React.FC = () => {
  const { id: tournamentId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [qrLinks, setQrLinks] = useState<QrLinks>({});
  const [qrStatus, setQrStatus] = useState<QrStatus>("idle");

  // One token request for the whole report (spec §5.1). A failure never blocks printing.
  const loadQrLinks = useCallback(async (forMatches: Match[]) => {
    if (forMatches.length === 0) {
      setQrLinks({});
      setQrStatus("ready");
      return;
    }
    setQrStatus("loading");
    try {
      const tokens = await issueMatchAccessTokens(forMatches.map((match) => match.id));
      setQrLinks(
        Object.fromEntries(
          tokens.map((token) => [token.matchId, { url: buildMatchAccessUrl(token.matchId, token.token), expiresAt: token.expiresAt }])
        )
      );
      setQrStatus("ready");
    } catch (qrError) {
      console.error("Failed to generate match QR codes:", qrError);
      setQrStatus("failed");
    }
  }, []);

  // Get parameters from URL
  const tournamentName = searchParams.get("tournamentName") || "Tournament";
  const viewType = (searchParams.get("viewType") || "general") as "venue" | "referee" | "team" | "general";
  const categoryName = searchParams.get("categoryName") || undefined;
  // `venueNames` repeats once per venue; `venueName` is kept for older links.
  const venueNamesParam = searchParams.getAll("venueNames").filter(Boolean);
  const venueNames =
    venueNamesParam.length > 0 ? venueNamesParam : [searchParams.get("venueName") || ""].filter(Boolean);
  const venueName = venueNames.length === 1 ? venueNames[0] : undefined;
  const refereeName = searchParams.get("refereeName") || undefined;
  const teamName = searchParams.get("teamName") || undefined;
  const formatName = searchParams.get("formatName") || undefined;

  // Get filter values from URL
  const filterStatusParam = searchParams.get("status") || "all";
  const filterStatus =
    filterStatusParam === "completed" ||
    filterStatusParam === "in-progress" ||
    filterStatusParam === "upcoming" ||
    filterStatusParam === "all"
      ? (filterStatusParam as "all" | "completed" | "in-progress" | "upcoming")
      : "all";
  const filterCategory = searchParams.get("category") || "all";
  const filterFormat = searchParams.get("format") || "all";
  const filterRound = searchParams.get("round") || "all";
  const venuesFromUrl = searchParams.getAll("venues").filter((venue) => venue && venue !== "all");
  const legacyVenue = searchParams.get("venue");
  const filterVenuesKey = JSON.stringify(
    venuesFromUrl.length > 0 ? venuesFromUrl : legacyVenue && legacyVenue !== "all" ? [legacyVenue] : []
  );
  // Memoised so the fetch effect compares venues by value, not array identity.
  const filterVenues: string[] = useMemo(() => JSON.parse(filterVenuesKey), [filterVenuesKey]);
  const filterTeam = searchParams.get("team") || "all";
  const filterReferee = searchParams.get("referee") || "all";
  const filterDate = searchParams.get("date") || "all";
  const searchTerm = searchParams.get("search") || "";

  useEffect(() => {
    const fetchMatches = async () => {
      if (!tournamentId) {
        setError("Tournament ID is required");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const filters: MatchFilters = {
          tournament: tournamentId,
          status: filterStatus !== "all" ? (filterStatus as "completed" | "in-progress" | "upcoming") : undefined,
          category: filterCategory !== "all" ? filterCategory : undefined,
          format: filterFormat !== "all" ? filterFormat : undefined,
          round: filterRound !== "all" ? filterRound : undefined,
          venues: filterVenues.length > 0 ? filterVenues : undefined,
          team: filterTeam !== "all" ? filterTeam : undefined,
          referee: filterReferee !== "all" ? filterReferee : undefined,
          date: filterDate !== "all" ? filterDate : undefined,
          search: searchTerm || undefined,
          pageSize: 1000, // Get all matches for printing
        };

        // Remove undefined values
        Object.keys(filters).forEach(
          (key) => filters[key as keyof MatchFilters] === undefined && delete filters[key as keyof MatchFilters]
        );

        const response = await getRefereeMatches(filters);
        const allMatches: Match[] = response.data.data.matches.items || [];
        setMatches(allMatches);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load matches";
        setError(errorMessage);
        console.error("Error fetching matches:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, [
    tournamentId,
    filterStatus,
    filterCategory,
    filterFormat,
    filterRound,
    filterVenues,
    filterTeam,
    filterReferee,
    filterDate,
    searchTerm,
  ]);

  useEffect(() => {
    if (!loading && !error) void loadQrLinks(matches);
  }, [matches, loading, error, loadQrLinks]);

  const handleClose = () => {
    // Close the window since it was opened in a new tab/window via window.open()
    window.close();

    // Fallback: if window.close() doesn't work (some browsers block it),
    // navigate back to matches management page
    setTimeout(() => {
      if (tournamentId) {
        navigate(`/tournaments/${tournamentId}/matches?name=${encodeURIComponent(tournamentName)}`);
      } else {
        navigate(-1);
      }
    }, 100);
  };

  if (loading) {
    return (
      <div className="printable-view-page">
        <div className="loading-container">
          <VolleyballLoading message="Loading matches..." size="medium" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="printable-view-page">
        <div className="error-container">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={handleClose} className="back-btn">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="printable-view-page">
      <PrintableView
        matches={matches}
        tournamentName={tournamentName}
        categoryName={categoryName}
        venueName={venueName}
        venueNames={venueNames}
        refereeName={refereeName}
        teamName={teamName}
        formatName={formatName}
        viewType={viewType}
        onClose={handleClose}
        qrLinks={qrLinks}
        qrStatus={qrStatus}
        onRetryQr={() => loadQrLinks(matches)}
      />
    </div>
  );
};

export default PrintableViewPage;
