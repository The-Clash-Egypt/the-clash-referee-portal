import React, { useState } from "react";
import { Venue, UpdateVenueDTO } from "../types/venue";
import VenueCard from "./VenueCard";
import { Button } from "../../../ui/Button";
import { Chip } from "../../../ui/Chip";
import { EmptyState } from "../../../ui/EmptyState";
import { Spinner } from "../../../ui/Spinner";
import "./VenueList.scss";

type LockFilter = "all" | "locked" | "open";

interface VenueListProps {
  venues: Venue[];
  onUpdate: (id: string, data: UpdateVenueDTO) => void;
  onShare?: (venue: Venue) => void;
  onShowQRCode?: (venue: Venue) => void;
  onForceGenerateToken?: (venue: Venue) => void;
  isLoading?: boolean;
  showActions?: boolean;
  loadingAction?: { venueId: string; action: "share" | "regenerate" | "qrCode" } | null;
  isUpdating?: boolean;
}

const hasPasswordSet = (venue: Venue): boolean => Boolean(venue.password && venue.password.trim() !== "");

/** Center Court first, then by the number in the name (Court 2 before Court 10), then alphabetically. */
const sortVenues = (venues: Venue[]): Venue[] =>
  [...venues].sort((a, b) => {
    const nameA = a.name.toLowerCase();
    const nameB = b.name.toLowerCase();

    if (nameA.includes("center court") || nameA.includes("centre court")) return -1;
    if (nameB.includes("center court") || nameB.includes("centre court")) return 1;

    const getNumericValue = (name: string): number => {
      const match = name.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : Infinity;
    };
    const numA = getNumericValue(nameA);
    const numB = getNumericValue(nameB);

    if (numA !== Infinity && numB !== Infinity) return numA - numB;
    if (numA !== Infinity) return -1;
    if (numB !== Infinity) return 1;
    return nameA.localeCompare(nameB);
  });

/**
 * The courts (mockup rest-of-portal.html phone 3): chips All N · Locked · Open · Has password (filtered here, as
 * before), then a card per court. The search sits in the app bar (VenueManagement).
 */
const VenueList: React.FC<VenueListProps> = ({
  venues,
  onUpdate,
  onShare,
  onShowQRCode,
  onForceGenerateToken,
  isLoading = false,
  showActions = true,
  loadingAction = null,
  isUpdating = false,
}) => {
  const [lock, setLock] = useState<LockFilter>("all");
  const [passwordOnly, setPasswordOnly] = useState(false);

  const hasActiveFilters = lock !== "all" || passwordOnly;
  const clearFilters = () => {
    setLock("all");
    setPasswordOnly(false);
  };
  const toggleLock = (value: Exclude<LockFilter, "all">) => setLock((current) => (current === value ? "all" : value));

  const filteredVenues = sortVenues(
    venues.filter((venue) => {
      if (lock !== "all" && venue.isLocked !== (lock === "locked")) return false;
      if (passwordOnly && !hasPasswordSet(venue)) return false;
      return true;
    })
  );

  let content: React.ReactNode;
  if (isLoading) {
    content = <Spinner label="Loading courts..." />;
  } else if (venues.length === 0) {
    content = (
      <EmptyState icon="courts" title="No courts found" body="Try adjusting your search or filters to find courts." />
    );
  } else if (filteredVenues.length === 0) {
    content = (
      <EmptyState
        icon="filter"
        title="No courts match your filters"
        body="Try adjusting your filter criteria or clear all filters to see all courts."
        action={
          <Button variant="tint" onClick={clearFilters}>
            Clear all filters
          </Button>
        }
      />
    );
  } else {
    content = (
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
    );
  }

  return (
    <div className="venue-list">
      {!isLoading && venues.length > 0 ? (
        <div className="venue-list__chips" role="group" aria-label="Filter courts">
          <Chip className="ui-chip--card" selected={!hasActiveFilters} count={venues.length} onClick={clearFilters}>
            All
          </Chip>
          <Chip className="ui-chip--card" selected={lock === "locked"} onClick={() => toggleLock("locked")}>
            Locked
          </Chip>
          <Chip className="ui-chip--card" selected={lock === "open"} onClick={() => toggleLock("open")}>
            Open
          </Chip>
          <Chip className="ui-chip--card" selected={passwordOnly} onClick={() => setPasswordOnly((only) => !only)}>
            Has password
          </Chip>
        </div>
      ) : null}
      <div className="venue-list__content">{content}</div>
    </div>
  );
};

export default VenueList;
