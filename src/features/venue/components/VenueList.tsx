import React, { useState, useRef, useEffect } from "react";
import { Venue, UpdateVenueDTO } from "../types/venue";
import VenueCard from "./VenueCard";
import "./VenueList.scss";

interface VenueListProps {
  venues: Venue[];
  onUpdate: (id: string, data: UpdateVenueDTO) => void;
  onShare?: (venue: Venue) => void;
  onShowQRCode?: (venue: Venue) => void;
  onForceGenerateToken?: (venue: Venue) => void;
  onSearch: (searchTerm: string) => void;
  onFilter: (filters: any) => void;
  isLoading?: boolean;
  searchTerm?: string;
  showActions?: boolean;
  showSearchAndFilters?: boolean;
  loadingAction?: { venueId: string; action: "share" | "regenerate" | "qrCode" } | null;
  isUpdating?: boolean;
}

const VenueList: React.FC<VenueListProps> = ({
  venues,
  onUpdate,
  onShare,
  onShowQRCode,
  onForceGenerateToken,
  onSearch,
  onFilter,
  isLoading = false,
  searchTerm = "",
  showActions = true,
  showSearchAndFilters = true,
  loadingAction = null,
  isUpdating = false,
}) => {
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    locked: "all",
    hasPassword: "all",
  });
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearchTerm(value);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      onSearch(value);
    }, 300);
  };

  const handleClearSearch = () => {
    setLocalSearchTerm("");
    onSearch("");

    // Clear any pending timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    // No API call - filtering is done locally
  };

  const clearFilters = () => {
    setFilters({
      locked: "all",
      hasPassword: "all",
    });
    // No API call - filtering is done locally
  };

  // Filter venues based on current filter criteria
  const filterVenues = (venues: Venue[]): Venue[] => {
    return venues.filter((venue) => {
      // Filter by lock status
      if (filters.locked !== "all") {
        const isLocked = filters.locked === "true";
        if (venue.isLocked !== isLocked) {
          return false;
        }
      }

      // Filter by password presence
      if (filters.hasPassword !== "all") {
        const hasPassword = filters.hasPassword === "true";
        const venueHasPassword = Boolean(venue.password && venue.password.trim() !== "");
        if (venueHasPassword !== hasPassword) {
          return false;
        }
      }

      return true;
    });
  };

  // Sort venues: Center Court first, then by numeric value
  const sortVenues = (venues: Venue[]): Venue[] => {
    return [...venues].sort((a, b) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();

      // Center Court always comes first
      if (nameA.includes("center court") || nameA.includes("centre court")) {
        return -1;
      }
      if (nameB.includes("center court") || nameB.includes("centre court")) {
        return 1;
      }

      // Extract numbers from venue names
      const getNumericValue = (name: string): number => {
        const match = name.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : Infinity;
      };

      const numA = getNumericValue(nameA);
      const numB = getNumericValue(nameB);

      // If both have numbers, sort by number
      if (numA !== Infinity && numB !== Infinity) {
        return numA - numB;
      }

      // If only one has a number, number comes first
      if (numA !== Infinity) return -1;
      if (numB !== Infinity) return 1;

      // If neither has numbers, sort alphabetically
      return nameA.localeCompare(nameB);
    });
  };

  const hasActiveFilters = Object.values(filters).some((value) => value && value !== "all");

  // Get filtered and sorted venues
  const filteredVenues = sortVenues(filterVenues(venues));
  const hasNoResults = venues.length > 0 && filteredVenues.length === 0;

  return (
    <div className="venue-list">
      {showSearchAndFilters && (
        <>
          <div className="venue-list__search-bar">
            <div className="search-input-container">
              <input
                type="text"
                placeholder="Search venues..."
                value={localSearchTerm}
                onChange={handleSearchChange}
                className="search-input"
              />
              {localSearchTerm && (
                <button onClick={handleClearSearch} className="search-clear-btn" title="Clear search">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
                  </svg>
                </button>
              )}
            </div>
            <button
              className={`filters-toggle ${showFilters ? "active" : ""}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14,12V19.88C14.04,20.18 13.94,20.5 13.71,20.71C13.32,21.1 12.69,21.1 12.3,20.71L10.29,18.7C10.06,18.47 9.96,18.16 10,17.87V12H9.97L4.21,4.62C3.87,4.19 3.95,3.56 4.38,3.22C4.57,3.08 4.78,3 5,3V3H19V3C19.22,3 19.43,3.08 19.62,3.22C20.05,3.56 20.13,4.19 19.79,4.62L14.03,12H14Z" />
              </svg>
              Filters
              {hasActiveFilters && (
                <span className="filter-badge">{Object.values(filters).filter((v) => v && v !== "all").length}</span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="venue-list__filters-panel">
              <div className="filters-grid">
                <div className="filter-field">
                  <label className="filter-label">Lock Status</label>
                  <select
                    value={filters.locked}
                    onChange={(e) => handleFilterChange("locked", e.target.value)}
                    className="filter-select"
                  >
                    <option value="all">All</option>
                    <option value="true">Locked</option>
                    <option value="false">Unlocked</option>
                  </select>
                </div>
                <div className="filter-field">
                  <label className="filter-label">Password</label>
                  <select
                    value={filters.hasPassword}
                    onChange={(e) => handleFilterChange("hasPassword", e.target.value)}
                    className="filter-select"
                  >
                    <option value="all">All</option>
                    <option value="true">Has Password</option>
                    <option value="false">No Password</option>
                  </select>
                </div>
              </div>
              <div className="filters-actions">
                <button onClick={clearFilters} className="btn btn--secondary btn--sm">
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <div className="venue-list__content">
        {isLoading ? (
          <div className="venue-list__loading">
            <div className="loading-spinner"></div>
            <p>Loading venues...</p>
          </div>
        ) : venues.length === 0 ? (
          <div className="venue-list__empty">
            <div className="empty-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,2C8.13,2 5,5.13 5,9C5,14.25 12,22 12,22S19,14.25 19,9C19,5.13 15.87,2 12,2M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5Z" />
              </svg>
            </div>
            <h3>No venues found</h3>
            <p>Try adjusting your search or filters to find venues.</p>
          </div>
        ) : hasNoResults ? (
          <div className="venue-list__empty">
            <div className="empty-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z" />
              </svg>
            </div>
            <h3>No venues match your filters</h3>
            <p>Try adjusting your filter criteria or clear all filters to see all venues.</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="btn btn--primary btn--sm" style={{ marginTop: "1rem" }}>
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="venue-list__grid">
            {filteredVenues.map((venue) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                onUpdate={onUpdate}
                onShare={onShare}
                onShowQRCode={onShowQRCode}
                onForceGenerateToken={onForceGenerateToken}
                showActions={showActions}
                loadingAction={loadingAction?.venueId === venue.id ? loadingAction.action : null}
                isUpdating={isUpdating}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VenueList;
