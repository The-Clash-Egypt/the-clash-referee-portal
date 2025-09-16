import React, { useState } from "react";
import { Venue, UpdateVenueDTO } from "../types/venue";
import VenueCard from "./VenueCard";
import "./VenueList.scss";

interface VenueListProps {
  venues: Venue[];
  onUpdate: (id: string, data: UpdateVenueDTO) => void;
  onShare?: (venue: Venue) => void;
  onSearch: (searchTerm: string) => void;
  onFilter: (filters: any) => void;
  isLoading?: boolean;
  searchTerm?: string;
  showActions?: boolean;
  showSearchAndFilters?: boolean;
  generatingTokenFor?: string | null;
  isUpdating?: boolean;
}

const VenueList: React.FC<VenueListProps> = ({
  venues,
  onUpdate,
  onShare,
  onSearch,
  onFilter,
  isLoading = false,
  searchTerm = "",
  showActions = true,
  showSearchAndFilters = true,
  generatingTokenFor = null,
  isUpdating = false,
}) => {
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    locked: "all",
    city: "",
    state: "",
    country: "",
    isActive: "all",
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearchTerm(value);

    // Debounce search
    const timeoutId = setTimeout(() => {
      onSearch(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilter(newFilters);
  };

  const clearFilters = () => {
    setFilters({
      locked: "all",
      city: "",
      state: "",
      country: "",
      isActive: "all",
    });
    onFilter({});
  };

  const hasActiveFilters = Object.values(filters).some((value) => value && value !== "all");

  return (
    <div className="venue-list">
      {showSearchAndFilters && (
        <>
          <div className="venue-list__header">
            <div className="venue-list__search">
              <div className="search-input">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search venues..."
                  value={localSearchTerm}
                  onChange={handleSearchChange}
                  className="search-input__field"
                />
                {localSearchTerm && (
                  <button
                    onClick={() => {
                      setLocalSearchTerm("");
                      onSearch("");
                    }}
                    className="search-input__clear"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="venue-list__filters">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`btn btn--secondary ${showFilters ? "active" : ""}`}
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
                  <label className="filter-label">City</label>
                  <input
                    type="text"
                    placeholder="Filter by city"
                    value={filters.city}
                    onChange={(e) => handleFilterChange("city", e.target.value)}
                    className="filter-input"
                  />
                </div>
                <div className="filter-field">
                  <label className="filter-label">State</label>
                  <input
                    type="text"
                    placeholder="Filter by state"
                    value={filters.state}
                    onChange={(e) => handleFilterChange("state", e.target.value)}
                    className="filter-input"
                  />
                </div>
                <div className="filter-field">
                  <label className="filter-label">Country</label>
                  <input
                    type="text"
                    placeholder="Filter by country"
                    value={filters.country}
                    onChange={(e) => handleFilterChange("country", e.target.value)}
                    className="filter-input"
                  />
                </div>
                <div className="filter-field">
                  <label className="filter-label">Status</label>
                  <select
                    value={filters.isActive}
                    onChange={(e) => handleFilterChange("isActive", e.target.value)}
                    className="filter-select"
                  >
                    <option value="all">All</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
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
        ) : (
          <div className="venue-list__grid">
            {venues.map((venue) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                onUpdate={onUpdate}
                onShare={onShare}
                showActions={showActions}
                isGeneratingToken={generatingTokenFor === venue.id}
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
