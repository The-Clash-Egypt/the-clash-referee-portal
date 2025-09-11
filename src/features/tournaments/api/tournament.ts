import api from "../../../api/axios";
import { TournamentListResponse } from "../types";

// Get tournaments list
export const getTournaments = (): Promise<{ data: TournamentListResponse }> => {
  return api.get("tournament/list");
};
