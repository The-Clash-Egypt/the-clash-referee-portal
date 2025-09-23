export interface Tournament {
  id: string;
  name: string;
  status: "active" | "inactive" | "upcoming" | "completed";
  categories: string[];
  startDate: string;
  endDate: string;
}

export interface TournamentListResponse {
  data: Tournament[];
}
