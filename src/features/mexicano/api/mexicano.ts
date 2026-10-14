import api from "../../../api/axios";
import { MexicanoSession, MexicanoStatus } from "../types";

/**
 * Live rounds (spec 2026-09-29 §3.2), for Mexicano and Roulette stages alike: the server answers the Mexicano prefix for
 * both and goes by the stage's own format. Every action returns the updated session.
 */

export interface ApiEnvelope<T> {
  data: T;
  success: boolean;
  message: string;
}

export const byFormat = (formatId: string) => `formatId=${encodeURIComponent(formatId)}`;

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

/**
 * Pair `unitSize` unpaired players (TeamMember ids) into one Playing team, named `name` when one is typed; without one
 * the server names it after its players ("A / B").
 */
export const createMexicanoUnit = async (formatId: string, memberIds: string[], name?: string): Promise<MexicanoSession> => {
  const typed = name?.trim();
  const body = typed ? { memberIds, name: typed } : { memberIds };
  return (await api.post<ApiEnvelope<MexicanoSession>>(`/Mexicano/units?${byFormat(formatId)}`, body)).data.data;
};

/** Rename a team of the stage (unit size 2+), any time before the event ends; the name shows everywhere. */
export const renameMexicanoUnit = async (formatId: string, teamId: string, name: string): Promise<MexicanoSession> =>
  (
    await api.put<ApiEnvelope<MexicanoSession>>(`/Mexicano/units/${encodeURIComponent(teamId)}?${byFormat(formatId)}`, {
      name,
    })
  ).data.data;

/** Break up a team that hasn't been drawn yet; its players go back to the unpaired list. */
export const dissolveMexicanoUnit = async (formatId: string, teamId: string): Promise<MexicanoSession> =>
  (await api.delete<ApiEnvelope<MexicanoSession>>(`/Mexicano/units/${encodeURIComponent(teamId)}?${byFormat(formatId)}`))
    .data.data;

/** The server's reason for a refused action (400 → { message }), else the fallback. */
export const mexicanoErrorMessage = (error: unknown, fallback: string): string => {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return message && message.trim() ? message : fallback;
};
