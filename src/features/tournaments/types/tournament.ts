export interface Tournament {
  id: string;
  name: string;
  status: "active" | "inactive" | "upcoming" | "completed";
  categories: string[];
}

export interface TournamentListResponse {
  data: Tournament[];
}
