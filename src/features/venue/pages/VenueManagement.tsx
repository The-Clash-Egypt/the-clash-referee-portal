import React, { useEffect, useRef, useState } from "react";
import { Venue, UpdateVenueDTO, VenueFilters } from "../types/venue";
import { useVenues, useUpdateVenue } from "../hooks/useVenues";
import { generateVenueToken } from "../api/venue";
import { VenueList } from "../components";
import VenueQRCodeModal from "../components/VenueQRCodeModal";
import { AppBarSlot } from "../../tournament-shell/AppBarSlot";
import { Button } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { SearchInput } from "../../../ui/SearchInput";
import { useToast } from "../../../ui/Toast";
import "./VenueManagement.scss";

interface VenueManagementProps {
  tournamentId?: string;
}

/** How long typing waits before the court search reaches the API (as before). */
const SEARCH_DEBOUNCE_MS = 300;

type LoadingAction = { venueId: string; action: "share" | "regenerate" | "qrCode" } | null;

/** A court's guest link (the public court page). */
const shareUrlOf = (venue: Venue, token: string) =>
  `${window.location.origin}/venue/shared?venueId=${venue.id}&token=${token}`;

/**
 * The Courts tab (mockup rest-of-portal.html phone 3): "Search courts" in the app bar, then the courts. The same API
 * calls as the old Venues tab; what used to be alerts are toasts now.
 */
const VenueManagement: React.FC<VenueManagementProps> = ({ tournamentId }) => {
  const { show } = useToast();
  const [searchInput, setSearchInput] = useState("");
  const searchTimer = useRef<number | undefined>(undefined);
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
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

  const { data: venuesResponse, isLoading, error, refetch: refetchVenues } = useVenues(filters);
  const updateVenueMutation = useUpdateVenue();

  const venues = venuesResponse?.data?.data || [];
  const fail = (message: string) => show(message, { tone: "error" });

  // A search still waiting must not fire after the tab has gone.
  useEffect(() => () => window.clearTimeout(searchTimer.current), []);

  // Typing searches 300 ms after the last key; clearing the field shows every court at once.
  const handleSearchChange = (term: string) => {
    setSearchInput(term);
    window.clearTimeout(searchTimer.current);
    const search = () =>
      setFilters((prev) => ({
        ...prev,
        search: term || undefined,
        pageNumber: 1,
      }));
    if (term) searchTimer.current = window.setTimeout(search, SEARCH_DEBOUNCE_MS);
    else search();
  };

  const handleUpdateVenue = (id: string, data: UpdateVenueDTO) => {
    updateVenueMutation.mutate(
      { id, data },
      {
        onError: (updateError) => {
          console.error("Failed to update venue:", updateError);
          fail("Failed to update the court. Please try again.");
        },
      }
    );
  };

  const handleShareVenue = async (venue: Venue) => {
    setLoadingAction({ venueId: venue.id, action: "share" });
    try {
      // Generate an access token (an existing valid one is reused)
      const response = await generateVenueToken(venue.id, false);

      if (response.data.success && response.data.data) {
        // Refresh the courts to show the updated expiry time
        await refetchVenues();

        const shareUrl = shareUrlOf(venue, response.data.data);
        const shareData = {
          title: `Referee Portal - ${venue.name}`,
          text: `Access the referee portal for ${venue.name} through this link: ${shareUrl}`,
        };

        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
          try {
            await navigator.share(shareData);
          } catch (shareError) {
            console.log("Share cancelled by user");
          }
        } else {
          fail("Sharing is not supported on this device. Please use a modern mobile browser.");
        }
      } else {
        fail(`Error: ${response.data.message || "Failed to generate share link. Please try again."}`);
      }
    } catch (shareLinkError) {
      console.error("Error generating share link:", shareLinkError);
      fail("Failed to generate share link. Please try again.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleShowQRCode = async (venue: Venue) => {
    setLoadingAction({ venueId: venue.id, action: "qrCode" });
    try {
      // Generate an access token (an existing valid one is reused)
      const response = await generateVenueToken(venue.id, false);

      if (response.data.success && response.data.data) {
        await refetchVenues();
        setQrCodeModal({
          isOpen: true,
          venueName: venue.name,
          shareUrl: shareUrlOf(venue, response.data.data),
        });
      } else {
        fail(`Error: ${response.data.message || "Failed to generate QR code. Please try again."}`);
      }
    } catch (qrError) {
      console.error("Error generating QR code:", qrError);
      fail("Failed to generate QR code. Please try again.");
    } finally {
      setLoadingAction(null);
    }
  };

  // ⋯ › New link: always a fresh token (the old Regenerate Token).
  const handleForceGenerateToken = async (venue: Venue) => {
    setLoadingAction({ venueId: venue.id, action: "regenerate" });
    try {
      const response = await generateVenueToken(venue.id, true);

      if (response.data.success && response.data.data) {
        await refetchVenues();
        show(`New link ready for ${venue.name}.`);
      } else {
        fail(`Error: ${response.data.message || "Failed to generate a new link. Please try again."}`);
      }
    } catch (tokenError) {
      console.error("Error force generating token:", tokenError);
      fail("Failed to generate a new link. Please try again.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCloseQRCode = () => {
    setQrCodeModal((current) => ({ ...current, isOpen: false }));
  };

  return (
    <div className="venue-management">
      <AppBarSlot>
        <div className="venue-management__search">
          <SearchInput
            value={searchInput}
            onChange={handleSearchChange}
            placeholder="Search courts"
            ariaLabel="Search courts"
          />
        </div>
      </AppBarSlot>

      {error && venues.length === 0 && !isLoading ? (
        <EmptyState
          icon="alert"
          title="Error"
          body="Failed to load courts. Please try again."
          action={
            <Button variant="tint" icon="refresh" onClick={() => void refetchVenues()}>
              Try again
            </Button>
          }
        />
      ) : (
        <VenueList
          venues={venues}
          onUpdate={handleUpdateVenue}
          onShare={handleShareVenue}
          onShowQRCode={handleShowQRCode}
          onForceGenerateToken={handleForceGenerateToken}
          isLoading={isLoading}
          showActions={true}
          loadingAction={loadingAction}
          isUpdating={updateVenueMutation.isPending}
        />
      )}

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
