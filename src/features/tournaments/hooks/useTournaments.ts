import { useQuery } from "@tanstack/react-query";
import { getTournaments } from "../api";
import { Tournament } from "../types";

export const useTournaments = () => {
  return useQuery<Tournament[]>({
    queryKey: ["tournaments"],
    queryFn: async () => {
      const response = await getTournaments();
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
};
