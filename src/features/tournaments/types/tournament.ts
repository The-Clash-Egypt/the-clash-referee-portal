export interface Tournament {
  id: string;
  name: string;
  status: "active" | "inactive" | "upcoming" | "completed" | "past";
  categories: string[];
  startDate: string;
  endDate: string;
  sport?: string;
  // Some API responses use `type` instead of `sport` — accept both.
  type?: string;
}

export interface TournamentListResponse {
  data: Tournament[];
}
