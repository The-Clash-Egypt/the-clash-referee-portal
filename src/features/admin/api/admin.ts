import api from "../../../api/axios";
import { Match, Referee } from "../../matches/api/matches";

// Get all referees for admin
export const getAllRefereesForAdmin = (): Promise<{ data: { data: Referee[] } }> => api.get("/Referee/all");

// Get all matches for admin (same as referee matches but for admin view)
export const getAllMatchesForAdmin = (): Promise<{ data: Match[] }> => api.get("/Referee/matches");

// Assign referee to match
export const assignRefereeToMatch = (refereeId: string, matchId: string) =>
  api.post(`/Referee/${refereeId}/assign/${matchId}`);

// Unassign referee from match
export const unassignRefereeFromMatch = (refereeId: string, matchId: string) =>
  api.delete(`/Referee/${refereeId}/unassign/${matchId}`);

// Add referees
export const addReferees = (userIds: string[]) => api.post("/Referee", { userIds });

// Delete referee
export const deleteReferee = (id: string) => api.delete(`/Referee/${id}`);

// Get player suggestions for adding referees
export const getPlayerSuggestions = (search?: string) =>
  api.get(`/Player/suggestions/all${search ? `?search=${encodeURIComponent(search)}` : ""}`);
