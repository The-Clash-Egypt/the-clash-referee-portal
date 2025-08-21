import api from "../../../api/axios";
import { Match, Referee, UpdateMatchDTO } from "../../matches/api/matches";

// Get all referees for admin
export const getAllRefereesForAdmin = (): Promise<{ data: { data: Referee[] } }> => api.get("/Referee/all");

// Get all matches for admin (same as referee matches but for admin view)
export const getAllMatchesForAdmin = (): Promise<{ data: Match[] }> => api.get("/Referee/matches");

// Assign referee to match
export const assignRefereeToMatch = (refereeId: string, matchId: string) =>
  api.post(`/Referee/${refereeId}/assign/${matchId}`);

// Bulk assign referee to multiple matches (using Promise.allSettled for better error handling)
export const bulkAssignRefereeToMatches = async (refereeId: string, matchIds: string[]) => {
  const promises = matchIds.map((matchId) => assignRefereeToMatch(refereeId, matchId));
  const results = await Promise.allSettled(promises);

  // Check if any assignments failed
  const failedAssignments = results.filter((result) => result.status === "rejected");

  if (failedAssignments.length > 0) {
    throw new Error(`${failedAssignments.length} assignment(s) failed`);
  }

  return results.map((result) => (result as PromiseFulfilledResult<any>).value);
};

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

export const updateGroupMatch = (matchId: string, data: UpdateMatchDTO) => api.put(`/Group/match/${matchId}`, data);

export const updateLeagueMatch = (matchId: string, data: UpdateMatchDTO) => api.put(`/League/match/${matchId}`, data);

export const updateKnockoutMatch = (matchId: string, data: UpdateMatchDTO) =>
  api.put(`/Knockout/match/${matchId}`, data);
