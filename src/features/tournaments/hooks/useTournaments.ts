import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { RootState } from "../../../store";
import { getTournaments } from "../api";
import { Tournament } from "../types";

export const useTournaments = () => {
  const user = useSelector((state: RootState) => state.user.user);

  return useQuery<Tournament[]>({
    queryKey: ["tournaments", user?.id],
    queryFn: async () => {
      const response = await getTournaments();
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    enabled: !!user?.id, // Only run query when user is available
  });
};
