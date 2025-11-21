import React, { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Match, MatchFilters } from "../types/match";
import { getRefereeMatches } from "../api/matches";
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

  // Get parameters from URL
  const tournamentName = searchParams.get("tournamentName") || "Tournament";
  const viewType = (searchParams.get("viewType") || "general") as "venue" | "referee" | "team" | "general";
  const categoryName = searchParams.get("categoryName") || undefined;
  const venueName = searchParams.get("venueName") || undefined;
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
  const filterVenue = searchParams.get("venue") || "all";
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
          venue: filterVenue !== "all" ? filterVenue : undefined,
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
    filterVenue,
    filterTeam,
    filterReferee,
    filterDate,
    searchTerm,
  ]);

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
        refereeName={refereeName}
        teamName={teamName}
        formatName={formatName}
        viewType={viewType}
        onClose={handleClose}
      />
    </div>
  );
};

export default PrintableViewPage;
