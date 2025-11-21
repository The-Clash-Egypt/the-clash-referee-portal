import api from "../../../api/axios";
import {
  Venue,
  CreateVenueDTO,
  UpdateVenueDTO,
  VenueFilterDTO,
  VenueListResponse,
  VenueResponse,
  VenueDetailResponse,
} from "../types/venue";

// Get all venues
export const getAllVenues = (): Promise<{ data: VenueListResponse }> => {
  return api.get("/venue");
};

// Get venue by ID
export const getVenueById = (id: string): Promise<{ data: VenueResponse }> => {
  return api.get(`/venue/${id}`);
};

// Get venue by ID with matches (for guest access)
export const getGuestVenue = (id: string): Promise<{ data: VenueDetailResponse }> => {
  return api.get(`/venue/${id}`);
};

// Get venues by tournament ID
export const getVenuesByTournamentId = (tournamentId: string): Promise<{ data: VenueListResponse }> => {
  return api.get(`/venue/tournament/${tournamentId}`);
};

// Create venue
export const createVenue = (data: CreateVenueDTO): Promise<{ data: VenueResponse }> => {
  return api.post("/venue", data);
};

// Update venue
export const updateVenue = (id: string, data: UpdateVenueDTO): Promise<{ data: VenueResponse }> => {
  return api.put(`/venue/${id}`, data);
};

// Delete venue
export const deleteVenue = (id: string): Promise<{ data: VenueResponse }> => {
  return api.delete(`/venue/${id}`);
};

// Search venues
export const searchVenues = (searchTerm: string): Promise<{ data: VenueListResponse }> => {
  return api.get(`/venue/search?searchTerm=${encodeURIComponent(searchTerm)}`);
};

// Get filtered venues
export const getFilteredVenues = (filters: VenueFilterDTO): Promise<{ data: VenueListResponse }> => {
  const params = new URLSearchParams();

  if (filters.search) {
    params.append("searchTerm", filters.search);
  }
  if (filters.tournamentId) {
    params.append("tournamentId", filters.tournamentId);
  }
  if (filters.locked) {
    params.append("locked", filters.locked.toString());
  }

  const queryString = params.toString();
  const url = `/venue/filter/summary${queryString ? `?${queryString}` : ""}`;

  return api.get(url);
};

// Generate access token for venue
export const generateVenueToken = (
  venueId: string,
  forceNew: boolean = false
): Promise<{ data: { data: string; success: boolean; message: string; errors: string[] } }> => {
  return api.post(`/venue/${venueId}/generate-token`, { forceNew });
};

// Validate venue access token
export const validateVenueToken = (
  venueId: string,
  token: string
): Promise<{ data: { data: boolean; success: boolean; message: string; errors: string[] } }> => {
  return api.post(`/venue/${venueId}/validate-token`, { token });
};
