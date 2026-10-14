import { useQuery } from "@tanstack/react-query";
import { getTournamentStages } from "./api/stages";
import { TournamentStage } from "./types";

/** The stages tab's queries. The list is shared by the tab bar and the tab's page, so the formats load once. */
export const stageKeys = {
  all: ["tournament-stages"] as const,
  list: (tournamentId: string): unknown[] => [...stageKeys.all, "list", tournamentId],
  mexicanoSession: (formatId: string): unknown[] => [...stageKeys.all, "mexicano-session", formatId],
  americanoMatches: (formatId: string): unknown[] => [...stageKeys.all, "americano-matches", formatId],
};

/** The stages tab's name: the kind when the tournament has one kind ("Mexicano", "Roulette"...), else "Stages". */
export const stagesLabel = (stages: Pick<TournamentStage, "kind">[]): string => {
  const kinds = Array.from(new Set(stages.map((stage) => stage.kind)));
  return kinds.length === 1 ? kinds[0] : "Stages";
};

interface StagesQueryOptions {
  enabled?: boolean;
  /** Override the app's default; the tab's page passes 0 to read the list again on every visit. */
  staleTime?: number;
}

/** The tournament's Americano, Mexicano and Roulette stages (GET Tournament/{id}/formats). */
export const useTournamentStages = (tournamentId: string, { enabled = true, staleTime }: StagesQueryOptions = {}) =>
  useQuery({
    queryKey: stageKeys.list(tournamentId),
    queryFn: () => getTournamentStages(tournamentId),
    enabled: enabled && !!tournamentId,
    // Only when given: an explicit undefined would override the app's default staleTime.
    ...(staleTime === undefined ? {} : { staleTime }),
  });
