import api from "../../../api/axios";
import { MexicanoSession, MexicanoStage, MexicanoStatus } from "../types";

/** Mexicano live rounds (spec 2026-09-29 §3.2). Every action returns the updated session. */

interface ApiEnvelope<T> {
  data: T;
  success: boolean;
  message: string;
}

interface TournamentFormats {
  categories: { name: string; formats: { formatId: string; formatName: string; aliasName: string | null }[] }[];
}

const byFormat = (formatId: string) => `formatId=${encodeURIComponent(formatId)}`;

export const getMexicanoSession = async (formatId: string): Promise<MexicanoSession> =>
  (await api.get<ApiEnvelope<MexicanoSession>>(`/Mexicano/session?${byFormat(formatId)}`)).data.data;

export const updateMexicanoPlayers = async (
  formatId: string,
  updates: { teamId: string; status: MexicanoStatus }[]
): Promise<MexicanoSession> =>
  (await api.put<ApiEnvelope<MexicanoSession>>(`/Mexicano/players?${byFormat(formatId)}`, updates)).data.data;

export const startNextMexicanoRound = async (formatId: string): Promise<MexicanoSession> =>
  (await api.post<ApiEnvelope<MexicanoSession>>(`/Mexicano/next-round?${byFormat(formatId)}`)).data.data;

export const undoMexicanoRound = async (formatId: string): Promise<MexicanoSession> =>
  (await api.delete<ApiEnvelope<MexicanoSession>>(`/Mexicano/round?${byFormat(formatId)}`)).data.data;

export const finishMexicano = async (formatId: string): Promise<MexicanoSession> =>
  (await api.post<ApiEnvelope<MexicanoSession>>(`/Mexicano/finish?${byFormat(formatId)}`)).data.data;

/** The tournament's Mexicano stages (GET Tournament/{id}/formats; formatName is the block type). */
export const getMexicanoStages = async (tournamentId: string): Promise<MexicanoStage[]> => {
  const response = await api.get<ApiEnvelope<TournamentFormats | null>>(
    `/Tournament/${encodeURIComponent(tournamentId)}/formats`
  );
  return (response.data.data?.categories ?? []).flatMap((category) =>
    category.formats
      .filter((format) => format.formatName === "Mexicano")
      .map((format) => ({
        formatId: format.formatId,
        categoryName: category.name,
        stageName: format.aliasName || "Mexicano",
      }))
  );
};

/** The server's reason for a refused action (400 → { message }), else the fallback. */
export const mexicanoErrorMessage = (error: unknown, fallback: string): string => {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return message && message.trim() ? message : fallback;
};
