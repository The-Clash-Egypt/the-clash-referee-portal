import api from "../../../api/axios";
import { AmericanoFinishResult, AmericanoMatch } from "../types";
import { ApiEnvelope, byFormat } from "./mexicano";

/** An Americano stage's whole schedule, Round 1 first (every round is drawn up front). */
export const getAmericanoMatches = async (formatId: string): Promise<AmericanoMatch[]> =>
  (await api.get<ApiEnvelope<AmericanoMatch[] | null>>(`/Americano/matches?${byFormat(formatId)}`)).data.data ?? [];

/**
 * Finish an Americano stage early: the server deletes every unscored match, keeps every scored one and ends the stage
 * after the rounds played. A refusal (400) carries its reason in `message` (see mexicanoErrorMessage).
 */
export const finishAmericano = async (formatId: string): Promise<AmericanoFinishResult> =>
  (await api.post<ApiEnvelope<AmericanoFinishResult>>(`/Americano/finish?${byFormat(formatId)}`)).data.data;
