import { useCallback, useState } from "react";
import { useSelector } from "react-redux";
import { useQueryClient } from "@tanstack/react-query";
import moment from "moment";
import { RootState } from "../../../store";
import { useToast } from "../../../ui/Toast";
import { hasFullAccess } from "../../auth/permissions";
import {
  assignRefereeToMatch,
  bulkAssignRefereeToMatches,
  unassignRefereeFromMatch,
  updateAmericanoMatch,
  updateGroupMatch,
  updateKnockoutMatch,
  updateLeagueMatch,
  updateMatchByFormat,
  updateMexicanoMatch,
  UnknownMatchFormatError,
} from "../api/matches";
import { assignRefereeTeams, unassignRefereeTeam } from "../api/refereeTeams";
import { forgetRefereeTeamOptions } from "./useRefereeTeamOptions";
import { FilterOptions, Match, MatchGameScore, Referee, RefereeTeamAssignResult, sideDisplayName } from "../types/match";
import type { BulkScoreEntry, BulkScoreResult } from "../components/BulkUpdateScoreModal";
import { nameForValue } from "../utils/filterOptions";
import { matchListKeys } from "./useMatchList";
import { MatchFilterState } from "./useMatchFilters";

/** A readable reason for a failed request: the server's message when it sent one. */
export const describeSaveError = (error: unknown, fallback = "Couldn't save this match. Please try again."): string => {
  if (error instanceof UnknownMatchFormatError) return error.message;
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return message || fallback;
};

export type MatchEdit = { venue?: string | null; startTime?: string | null; bestOf?: number | null };
export type BulkMatchEdit = { matchId: string; venue?: string | null; bestOf?: number | null };
export type ExportViewType = "venue" | "referee" | "team" | "general";

/** Saves a match's time/court/best-of through its format's endpoint (unknown formats: nothing to call). */
const updateByFormat = (match: Match, data: MatchEdit) => {
  if (match.formatType === "Group") return updateGroupMatch(match.id, data);
  if (match.formatType === "League") return updateLeagueMatch(match.id, data);
  if (match.formatType === "Knockout") return updateKnockoutMatch(match.id, data);
  if (match.formatType === "Americano") return updateAmericanoMatch(match.id, data);
  if (match.formatType === "Mexicano") return updateMexicanoMatch(match.id, data);
  return undefined;
};

type MessageReferee = Partial<Pick<Referee, "fullName" | "phoneNumber">> & { firstName?: string; lastName?: string };

const refereeNameOf = (referee: MessageReferee) =>
  referee.fullName || `${referee.firstName || ""} ${referee.lastName || ""}`.trim();

/**
 * The WhatsApp message about one match (today's per-referee share). Without a referee — the match sheet's Share,
 * sent to a chat picked in WhatsApp — the Referee line names the match's referees, or is left out when it has none.
 */
export const matchWhatsAppMessage = (match: Match, referee?: MessageReferee): string => {
  const refereeName = referee
    ? refereeNameOf(referee)
    : (match.referees ?? []).map((r) => r.fullName).filter(Boolean).join(", ");
  const appUrl = window.location.origin;
  const matchTime = match.startTime ? moment(match.startTime).format("MMMM Do YYYY, h:mm a") : "TBD";
  const venue = match.venue || "TBD";
  const teams = `${sideDisplayName(match.homeTeamName, match.homeTeam2Name)} vs ${sideDisplayName(
    match.awayTeamName,
    match.awayTeam2Name
  )}`;
  const tournamentName = match.tournamentName || "Tournament";
  const categoryName = match.categoryName || "";
  const round = match.round || "";

  return `🏐 *Match Assignment*

*Tournament:* ${tournamentName}${categoryName ? ` (${categoryName})` : ""}${referee || refereeName ? `\n*Referee:* ${refereeName}` : ""}

*Match Details:*
• Teams: ${teams}
• Venue: ${venue}
• Time: ${matchTime}${round ? `\n• Round: ${round}` : ""}

*Please confirm availability.*
*Portal:* ${appUrl}`;
};

/** One referee's matches, grouped by category then date (today's bulk WhatsApp message). */
export const bulkWhatsAppMessage = (referee: MessageReferee, refereeMatches: Match[]): string => {
  const refereeName = refereeNameOf(referee);
  const appUrl = window.location.origin;
  const firstMatch = refereeMatches[0];
  const tournamentName = firstMatch?.tournamentName || "Tournament";

  const matchesByCategory = refereeMatches.reduce(
    (acc, match) => {
      const category = match.categoryName || "General";
      if (!acc[category]) acc[category] = [];
      acc[category].push(match);
      return acc;
    },
    {} as Record<string, Match[]>
  );

  let message = `🏐 *Referee Assignment*

*Tournament:* ${tournamentName}
*Referee:* ${refereeName}
*Total Matches:* ${refereeMatches.length}

*Your Matches:*`;

  Object.entries(matchesByCategory).forEach(([category, categoryMatches]) => {
    message += `\n\n*${category}:*`;
    const matchesByDate = categoryMatches.reduce(
      (acc, match) => {
        const date = match.startTime
          ? new Date(match.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : "TBD";
        if (!acc[date]) acc[date] = [];
        acc[date].push(match);
        return acc;
      },
      {} as Record<string, Match[]>
    );
    Object.entries(matchesByDate).forEach(([date, matches]) => {
      message += `\n\n  *${date}:*`;
      matches.forEach((match) => {
        const time = match.startTime
          ? new Date(match.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
          : "TBD";
        const teams = `${match.homeTeamName || "TBD"} vs ${match.awayTeamName || "TBD"}`;
        const venue = match.venue || "TBD";
        const round = match.round ? ` - ${match.round}` : "";
        message += `\n  • ${time} - ${teams} (${venue})${round}`;
      });
    });
  });

  message += `\n\n*Please confirm availability.*\n*Portal:* ${appUrl}`;
  return message;
};

/** The referees of some matches who have a phone number, once each (by number). */
export const refereesWithPhones = (matches: Match[]): Referee[] => {
  const byPhone = new Map<string, Referee>();
  matches.forEach((match) =>
    match.referees?.forEach((referee) => {
      if (referee.phoneNumber) byPhone.set(referee.phoneNumber, referee);
    })
  );
  return Array.from(byPhone.values());
};

/**
 * Everything the matches screen does to matches, with today's API calls, guards (full access) and messages. Failures
 * show as error toasts (they were alerts). After any change the matches list and its counts refresh.
 * The caller owns which sheet is open: each action resolves with whether it worked, so the sheet can close.
 */
export function useMatchActions(tournamentId: string) {
  const queryClient = useQueryClient();
  const user = useSelector((state: RootState) => state.user.user);
  const fullAccess = hasFullAccess(user);
  const { show } = useToast();

  const [assigningReferee, setAssigningReferee] = useState(false);
  const [bulkAssigningReferee, setBulkAssigningReferee] = useState(false);
  const [editingMatch, setEditingMatch] = useState(false);
  const [bulkEditingMatches, setBulkEditingMatches] = useState(false);
  const [updatingScore, setUpdatingScore] = useState(false);

  const fail = useCallback((message: string) => show(message, { tone: "error" }), [show]);

  /** Refetches the list, its counts and the Up next extras (awaits the ones on screen). */
  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: matchListKeys.all }), [queryClient]);

  const assignReferees = async (match: Match | null, refereeIds: string[]): Promise<boolean> => {
    if (!match || !fullAccess || refereeIds.length === 0) return false;
    try {
      setAssigningReferee(true);
      await Promise.all(refereeIds.map((refereeId) => assignRefereeToMatch(refereeId, match.id)));
      await refresh();
      return true;
    } catch (error) {
      console.error("Error assigning referees:", error);
      fail(`Failed to assign ${refereeIds.length > 1 ? "referees" : "referee"}. Please try again.`);
      return false;
    } finally {
      setAssigningReferee(false);
    }
  };

  /** Several referees to several matches. Resolves true when all were assigned (the caller decides what closes). */
  const bulkAssignReferees = async (refereeIds: string[], matchIds: string[]): Promise<boolean> => {
    if (!fullAccess) return false;
    try {
      setBulkAssigningReferee(true);
      await Promise.all(refereeIds.map((refereeId) => bulkAssignRefereeToMatches(refereeId, matchIds)));
      await refresh();
      return true;
    } catch (error) {
      console.error("Error bulk assigning referees:", error);
      fail(
        (error as Error)?.message ||
          `Failed to assign ${refereeIds.length > 1 ? "referees" : "referee"} to one or more matches. Please try again.`
      );
      return false;
    } finally {
      setBulkAssigningReferee(false);
    }
  };

  // After a referee-team change both the list and every drawer's team options move.
  const refreshAfterRefereeTeamChange = () => {
    void forgetRefereeTeamOptions(queryClient);
    return refresh();
  };

  /** Resolves with the per-match outcome, or null when the request failed (already reported). */
  const assignTeams = async (teamIds: string[], matchIds: string[]): Promise<RefereeTeamAssignResult[] | null> => {
    if (!fullAccess || teamIds.length === 0 || matchIds.length === 0) return null;
    try {
      const results = await assignRefereeTeams(teamIds, matchIds);
      await refreshAfterRefereeTeamChange();
      return results;
    } catch (error) {
      console.error("Error assigning referee teams:", error);
      fail(describeSaveError(error, "Failed to assign the referee teams. Please try again."));
      return null;
    }
  };

  /** Resolves true once the team is off the match (a failure is reported). */
  const unassignTeam = async (matchId: string, teamId: string): Promise<boolean> => {
    if (!fullAccess) return false;
    try {
      await unassignRefereeTeam(matchId, teamId);
      await refreshAfterRefereeTeamChange();
      return true;
    } catch (error) {
      console.error("Error unassigning referee team:", error);
      fail(describeSaveError(error, "Failed to unassign the referee team. Please try again."));
      return false;
    }
  };

  /** Resolves true once the referee is off the match (a failure is reported). */
  const unassignReferee = async (refereeId: string, matchId: string): Promise<boolean> => {
    if (!fullAccess) return false;
    try {
      await unassignRefereeFromMatch(refereeId, matchId);
      await refresh();
      return true;
    } catch (error) {
      console.error("Error unassigning referee:", error);
      fail("Failed to unassign referee. Please try again.");
      return false;
    }
  };

  /** Time, court and best-of of one match. Resolves true when saved (the list refreshes behind the closed sheet). */
  const editMatch = async (match: Match | null, data: MatchEdit): Promise<boolean> => {
    if (!match || !fullAccess) return false;
    try {
      setEditingMatch(true);
      await updateByFormat(match, data);
      void refresh();
      return true;
    } catch (error) {
      console.error("Error editing match:", error);
      fail("Failed to update match. Please try again.");
      return false;
    } finally {
      setEditingMatch(false);
    }
  };

  /** Court and best-of of several matches (`matches` supplies each one's format). */
  const bulkEditMatches = async (updates: BulkMatchEdit[], matches: Match[]): Promise<boolean> => {
    if (!fullAccess) return false;
    try {
      setBulkEditingMatches(true);
      await Promise.all(
        updates.map(({ matchId, ...data }) => {
          const match = matches.find((m) => m.id === matchId);
          return match ? updateByFormat(match, data) : undefined;
        })
      );
      void refresh();
      return true;
    } catch (error) {
      console.error("Error bulk editing matches:", error);
      fail("Failed to update one or more matches. Please try again.");
      return false;
    } finally {
      setBulkEditingMatches(false);
    }
  };

  /** The bulk score sheet's save: every match through its own format's endpoint, each with its own outcome. */
  const saveBulkScores = async (entries: BulkScoreEntry[]): Promise<BulkScoreResult[]> => {
    if (!fullAccess) return entries.map(({ match }) => ({ matchId: match.id, ok: false, error: "Not allowed." }));
    const settled = await Promise.allSettled(
      entries.map(({ match, gameScores }) => updateMatchByFormat(match.formatType, match.id, { gameScores }))
    );
    const results = settled.map(
      (outcome, index): BulkScoreResult =>
        outcome.status === "fulfilled"
          ? { matchId: entries[index].match.id, ok: true }
          : { matchId: entries[index].match.id, ok: false, error: describeSaveError(outcome.reason) }
    );
    // Refresh the list behind the sheet.
    void refresh();
    return results;
  };

  /** Final scores from the score dialog. Resolves true once saved and the list has refreshed. */
  const submitScore = async (match: Match | null, gameScores: MatchGameScore[]): Promise<boolean> => {
    if (!match) return false;
    try {
      setUpdatingScore(true);
      // Each format saves through its own endpoint; unknown formats are refused, not guessed.
      await updateMatchByFormat(match.formatType, match.id, { gameScores });
      await refresh();
      return true;
    } catch (error) {
      console.error("Error updating scores:", error);
      fail(error instanceof UnknownMatchFormatError ? error.message : "Failed to update scores. Please try again.");
      return false;
    } finally {
      setUpdatingScore(false);
    }
  };

  /** The scoreboard closed: show its live scores in the list (in the background). */
  const scoreboardClosed = () => {
    void refresh();
  };

  /** WhatsApp one referee about one match (full access, as today). */
  const shareMatchWithReferee = (match: Match, referee: Referee) => {
    if (!referee.phoneNumber) {
      fail("Phone number not available for this referee");
      return;
    }
    const text = encodeURIComponent(matchWhatsAppMessage(match, referee));
    window.open(`https://wa.me/${referee.phoneNumber}?text=${text}`, "_blank");
  };

  /** The match sheet's Share: the same message, to a chat picked in WhatsApp. */
  const shareMatch = (match: Match) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(matchWhatsAppMessage(match))}`, "_blank");
  };

  /** Bulk WhatsApp, step 1: the selected matches' referees with a phone (none: says so and returns []). */
  const bulkWhatsAppReferees = (selected: Match[]): Referee[] => {
    const referees = refereesWithPhones(selected);
    if (referees.length === 0) fail("No referees with phone numbers found in selected matches");
    return referees;
  };

  /** Bulk WhatsApp, step 2: one referee's selected matches in one message. Resolves whether it was sent. */
  const sendBulkWhatsApp = (phoneNumber: string, selected: Match[]): boolean => {
    if (phoneNumber === "") {
      fail("No referees selected");
      return false;
    }
    const referee = refereesWithPhones(selected).find((ref) => ref.phoneNumber === phoneNumber);
    if (referee) {
      // Match by phone number, so one referee's matches across categories go in one message.
      const refereeMatches = selected.filter((match) => match.referees?.some((ref) => ref.phoneNumber === phoneNumber));
      if (refereeMatches.length > 0) {
        const text = encodeURIComponent(bulkWhatsAppMessage(referee, refereeMatches));
        window.open(`https://wa.me/${referee.phoneNumber}?text=${text}`, "_blank");
      }
    }
    return true;
  };

  /** Opens the printable preview of the matches under these filters (a new window, as today). */
  const exportView = (
    type: ExportViewType,
    filters: MatchFilterState,
    filterOptions: FilterOptions,
    opts: { tournamentName?: string | null; status?: string } = {}
  ) => {
    if (!tournamentId) return;
    const params = new URLSearchParams();
    params.set("tournamentName", opts.tournamentName || "Tournament");
    params.set("viewType", type);
    if (opts.status && opts.status !== "all") params.set("status", opts.status);
    if (filters.category !== "all") params.set("category", filters.category);
    if (filters.format !== "all") params.set("format", filters.format);
    if (filters.round !== "all") params.set("round", filters.round);
    filters.venues.forEach((venue) => params.append("venues", venue));
    if (filters.team !== "all") params.set("team", filters.team);
    if (filters.referee !== "all") params.set("referee", filters.referee);
    if (filters.date !== "all") params.set("date", filters.date);
    if (filters.search) params.set("search", filters.search);
    // Display names for the filters
    if (filters.category !== "all") params.set("categoryName", filters.category);
    filters.venues.forEach((venue) => params.append("venueNames", venue));
    if (filters.referee !== "all") params.set("refereeName", nameForValue(filterOptions.referees, filters.referee));
    if (filters.team !== "all") params.set("teamName", nameForValue(filterOptions.teams, filters.team));
    if (filters.format !== "all") params.set("formatName", filters.format);
    window.open(`/tournaments/${tournamentId}/matches/preview?${params.toString()}`, "_blank");
  };

  return {
    fullAccess,
    assigningReferee,
    bulkAssigningReferee,
    editingMatch,
    bulkEditingMatches,
    updatingScore,
    refresh,
    assignReferees,
    bulkAssignReferees,
    assignTeams,
    unassignTeam,
    unassignReferee,
    editMatch,
    bulkEditMatches,
    saveBulkScores,
    submitScore,
    scoreboardClosed,
    shareMatchWithReferee,
    shareMatch,
    bulkWhatsAppReferees,
    sendBulkWhatsApp,
    exportView,
  };
}

export type MatchActions = ReturnType<typeof useMatchActions>;

export default useMatchActions;
