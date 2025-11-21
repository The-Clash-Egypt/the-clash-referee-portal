import React, { useState } from "react";
import { Venue, UpdateVenueDTO, VenueFilters } from "../types/venue";
import { useVenues, useUpdateVenue } from "../hooks/useVenues";
import { generateVenueToken } from "../api/venue";
import { VenueList } from "../components";
import VenueQRCodeModal from "../components/VenueQRCodeModal";
import "./VenueManagement.scss";

interface VenueManagementProps {
  tournamentId?: string;
}

const VenueManagement: React.FC<VenueManagementProps> = ({ tournamentId }) => {
  // State management
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingAction, setLoadingAction] = useState<{ venueId: string; action: "share" | "regenerate" | "qrCode" } | null>(null);
  const [filters, setFilters] = useState<VenueFilters>({
    ...(tournamentId && { tournamentId }),
  });
  const [qrCodeModal, setQrCodeModal] = useState<{
    isOpen: boolean;
    venueName: string;
    shareUrl: string;
  }>({
    isOpen: false,
    venueName: "",
    shareUrl: "",
  });

  // API hooks
  const { data: venuesResponse, isLoading, error, refetch: refetchVenues } = useVenues(filters);
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
    setLoadingAction({ venueId: venue.id, action: "share" });
    try {
      // Generate a new access token (use existing if valid)
      const response = await generateVenueToken(venue.id, false);

      if (response.data.success && response.data.data) {
        // Refresh the venues list to show updated expiry time
        await refetchVenues();

        const shareUrl = `${window.location.origin}/venue/shared?venueId=${venue.id}&token=${response.data.data}`;
        const shareData = {
          title: `Referee Portal - ${venue.name}`,
          text: `Access the referee portal for ${venue.name} through this link: ${shareUrl}`,
          // url: shareUrl,
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
      setLoadingAction(null);
    }
  };

  // Handle show QR code
  const handleShowQRCode = async (venue: Venue) => {
    setLoadingAction({ venueId: venue.id, action: "qrCode" });
    try {
      // Generate a new access token (use existing if valid)
      const response = await generateVenueToken(venue.id, false);

      if (response.data.success && response.data.data) {
        // Refresh the venues list to show updated expiry time
        await refetchVenues();

        const shareUrl = `${window.location.origin}/venue/shared?venueId=${venue.id}&token=${response.data.data}`;
        setQrCodeModal({
          isOpen: true,
          venueName: venue.name,
          shareUrl,
        });
      } else {
        // Handle API error response
        const errorMessage = response.data.message || "Failed to generate QR code. Please try again.";
        alert(`Error: ${errorMessage}`);
      }
    } catch (error) {
      console.error("Error generating QR code:", error);
      alert("Failed to generate QR code. Please try again.");
    } finally {
      setLoadingAction(null);
    }
  };

  // Handle force generate token
  const handleForceGenerateToken = async (venue: Venue) => {
    setLoadingAction({ venueId: venue.id, action: "regenerate" });
    try {
      // Force generate a new access token
      const response = await generateVenueToken(venue.id, true);

      if (response.data.success && response.data.data) {
        // Refresh the venues list to show updated expiry time
        await refetchVenues();
      } else {
        // Handle API error response
        const errorMessage = response.data.message || "Failed to generate new token. Please try again.";
        alert(`Error: ${errorMessage}`);
      }
    } catch (error) {
      console.error("Error force generating token:", error);
      alert("Failed to generate new token. Please try again.");
    } finally {
      setLoadingAction(null);
    }
  };

  // Handle close QR code modal
  const handleCloseQRCode = () => {
    setQrCodeModal({
      isOpen: false,
      venueName: "",
      shareUrl: "",
    });
  };

  return (
    <div className="venue-management">
      {venues.length > 0 && (
        <div className="venue-management__header">
          <div className="venue-management__title">
            <h1>Venue Management</h1>
            <p>Manage venues for this tournament</p>
          </div>
        </div>
      )}

      <div className="venue-management__content">
        <VenueList
          venues={venues}
          onUpdate={handleUpdateVenue}
          onShare={handleShareVenue}
          onShowQRCode={handleShowQRCode}
          onForceGenerateToken={handleForceGenerateToken}
          onSearch={handleSearch}
          onFilter={handleFilter}
          isLoading={isLoading}
          searchTerm={searchTerm}
          showActions={true}
          showSearchAndFilters={venues.length > 0}
          loadingAction={loadingAction}
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

      {/* QR Code Modal */}
      <VenueQRCodeModal
        isOpen={qrCodeModal.isOpen}
        venueName={qrCodeModal.venueName}
        shareUrl={qrCodeModal.shareUrl}
        onClose={handleCloseQRCode}
      />
    </div>
  );
};

export default VenueManagement;
