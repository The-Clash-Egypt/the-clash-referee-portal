import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAllVenues,
  getVenueById,
  getVenuesByTournamentId,
  createVenue,
  updateVenue,
  deleteVenue,
  searchVenues,
  getFilteredVenues,
} from "../api/venue";
import { CreateVenueDTO, UpdateVenueDTO, VenueFilterDTO } from "../types/venue";

// Query keys
export const venueKeys = {
  all: ["venues"] as const,
  lists: () => [...venueKeys.all, "list"] as const,
  list: (filters: VenueFilterDTO) => [...venueKeys.lists(), filters] as const,
  details: () => [...venueKeys.all, "detail"] as const,
  detail: (id: string) => [...venueKeys.details(), id] as const,
  byTournament: (tournamentId: string) => [...venueKeys.all, "tournament", tournamentId] as const,
  search: (searchTerm: string) => [...venueKeys.all, "search", searchTerm] as const,
};

// Get all venues
export const useVenues = (filters?: VenueFilterDTO) => {
  return useQuery({
    queryKey: filters ? venueKeys.list(filters) : venueKeys.lists(),
    queryFn: () => (filters ? getFilteredVenues(filters) : getAllVenues()),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Get venue by ID
export const useVenue = (id: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: venueKeys.detail(id),
    queryFn: () => getVenueById(id),
    enabled: enabled && !!id,
    staleTime: 5 * 60 * 1000,
  });
};

// Get venues by tournament ID
export const useVenuesByTournament = (tournamentId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: venueKeys.byTournament(tournamentId),
    queryFn: () => getVenuesByTournamentId(tournamentId),
    enabled: enabled && !!tournamentId,
    staleTime: 5 * 60 * 1000,
  });
};

// Search venues
export const useVenueSearch = (searchTerm: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: venueKeys.search(searchTerm),
    queryFn: () => searchVenues(searchTerm),
    enabled: enabled && searchTerm.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes for search results
  });
};

// Create venue mutation
export const useCreateVenue = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateVenueDTO) => createVenue(data),
    onSuccess: (response) => {
      // Invalidate and refetch venue lists
      queryClient.invalidateQueries({ queryKey: venueKeys.lists() });

      // If the venue has a tournament ID, also invalidate that tournament's venues
      if (response.data.data.tournamentId) {
        queryClient.invalidateQueries({
          queryKey: venueKeys.byTournament(response.data.data.tournamentId),
        });
      }
    },
  });
};

// Update venue mutation
export const useUpdateVenue = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateVenueDTO }) => updateVenue(id, data),
    onSuccess: (response, variables) => {
      // Invalidate venue lists
      queryClient.invalidateQueries({ queryKey: venueKeys.lists() });

      // Invalidate specific venue detail
      queryClient.invalidateQueries({ queryKey: venueKeys.detail(variables.id) });

      // If the venue has a tournament ID, also invalidate that tournament's venues
      if (response.data.data.tournamentId) {
        queryClient.invalidateQueries({
          queryKey: venueKeys.byTournament(response.data.data.tournamentId),
        });
      }
    },
  });
};

// Delete venue mutation
export const useDeleteVenue = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteVenue(id),
    onSuccess: (response, id) => {
      // Invalidate venue lists
      queryClient.invalidateQueries({ queryKey: venueKeys.lists() });

      // Remove specific venue from cache
      queryClient.removeQueries({ queryKey: venueKeys.detail(id) });

      // If the venue had a tournament ID, also invalidate that tournament's venues
      if (response.data.data.tournamentId) {
        queryClient.invalidateQueries({
          queryKey: venueKeys.byTournament(response.data.data.tournamentId),
        });
      }
    },
  });
};
