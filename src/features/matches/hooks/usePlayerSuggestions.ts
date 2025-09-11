import { useQuery } from "@tanstack/react-query";
import { getPlayerSuggestions } from "../api/matches";
import { PlayerSuggestion } from "../types/match";

export const usePlayerSuggestions = (searchTerm: string) => {
  return useQuery<PlayerSuggestion[]>({
    queryKey: ["playerSuggestions", searchTerm],
    queryFn: async () => {
      const response = (await getPlayerSuggestions(searchTerm)).data;
      return response.data; // The API returns the array directly, not wrapped in a data property
    },
    enabled: searchTerm.length >= 2, // Only search when user has typed at least 2 characters
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
  });
};
