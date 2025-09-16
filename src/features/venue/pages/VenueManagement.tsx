import React, { useState } from "react";
import { Venue, UpdateVenueDTO, VenueFilters } from "../types/venue";
import { useVenues, useUpdateVenue } from "../hooks/useVenues";
import { generateVenueToken } from "../api/venue";
import { VenueList } from "../components";
import "./VenueManagement.scss";

interface VenueManagementProps {
  tournamentId?: string;
}

const VenueManagement: React.FC<VenueManagementProps> = ({ tournamentId }) => {
  // State management
  const [searchTerm, setSearchTerm] = useState("");
  const [generatingTokenFor, setGeneratingTokenFor] = useState<string | null>(null);
  const [filters, setFilters] = useState<VenueFilters>({
    ...(tournamentId && { tournamentId }),
  });

  // API hooks
  const { data: venuesResponse, isLoading, error } = useVenues(filters);
  const updateVenueMutation = useUpdateVenue();

  const venues = venuesResponse?.data?.data || [];

  // Handle search
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setFilters((prev) => ({
      ...prev,
      search: term || undefined,
      pageNumber: 1,
    }));
  };

  // Handle filters (not used - filtering is done locally in VenueList)
  const handleFilter = (newFilters: Partial<VenueFilters>) => {
    // No-op - filtering is handled locally in VenueList component
  };

  // Handle update venue directly
  const handleUpdateVenue = (id: string, data: UpdateVenueDTO) => {
    updateVenueMutation.mutate(
      { id, data },
      {
        onSuccess: () => {
          // Success handled by mutation
        },
        onError: (error) => {
          console.error("Failed to update venue:", error);
        },
      }
    );
  };

  // Handle share venue
  const handleShareVenue = async (venue: Venue) => {
    setGeneratingTokenFor(venue.id);
    try {
      // Generate a new access token
      const response = await generateVenueToken(venue.id);

      if (response.data.success && response.data.data) {
        const shareUrl = `${window.location.origin}/venue/shared?venueId=${venue.id}&token=${response.data.data}`;
        const shareData = {
          title: `Referee Portal - ${venue.name}`,
          text: `Access the referee portal for ${venue.name}`,
          url: shareUrl,
        };

        // Check if Web Share API is supported
        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
          try {
            await navigator.share(shareData);
            // Share was successful
          } catch (shareError) {
            // User cancelled sharing
            console.log("Share cancelled by user");
          }
        } else {
          // Web Share API not supported
          alert("Sharing is not supported on this device. Please use a modern mobile browser.");
        }
      } else {
        // Handle API error response
        const errorMessage = response.data.message || "Failed to generate share link. Please try again.";
        alert(`Error: ${errorMessage}`);
      }
    } catch (error) {
      console.error("Error generating share link:", error);
      alert("Failed to generate share link. Please try again.");
    } finally {
      setGeneratingTokenFor(null);
    }
  };

  return (
    <div className="venue-management">
      <div className="venue-management__header">
        <div className="venue-management__title">
          <h1>Venue Management</h1>
          <p>Manage venues for {tournamentId ? "this tournament" : "all tournaments"}</p>
        </div>
      </div>

      <div className="venue-management__content">
        <VenueList
          venues={venues}
          onUpdate={handleUpdateVenue}
          onShare={handleShareVenue}
          onSearch={handleSearch}
          onFilter={handleFilter}
          isLoading={isLoading}
          searchTerm={searchTerm}
          showActions={true}
          showSearchAndFilters={true}
          generatingTokenFor={generatingTokenFor}
          isUpdating={updateVenueMutation.isPending}
        />
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12,2C6.47,2 2,6.47 2,12C2,17.53 6.47,22 12,22C17.53,22 22,17.53 22,12C22,6.47 17.53,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z" />
          </svg>
          <span>Failed to load venues. Please try again.</span>
        </div>
      )}
    </div>
  );
};

export default VenueManagement;
