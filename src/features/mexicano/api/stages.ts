import api from "../../../api/axios";
import { StageKind, TournamentStage } from "../types";
import type { ApiEnvelope } from "./mexicano";

interface TournamentFormats {
  categories: {
    name: string;
    formats: { formatId: string; formatName: string; aliasName: string | null; isEnded?: boolean | null }[];
  }[];
}

const STAGE_KINDS: StageKind[] = ["Mexicano", "Americano"];

const isStageKind = (formatName: string): formatName is StageKind => (STAGE_KINDS as string[]).includes(formatName);

/**
 * The tournament's Americano and Mexicano stages, in the dashboard's order (GET Tournament/{id}/formats; formatName
 * is the block type). One call answers both the stages tab and its cards.
 */
export const getTournamentStages = async (tournamentId: string): Promise<TournamentStage[]> => {
  const response = await api.get<ApiEnvelope<TournamentFormats | null>>(
    `/Tournament/${encodeURIComponent(tournamentId)}/formats`
  );
  return (response.data.data?.categories ?? []).flatMap((category) =>
    category.formats.flatMap((format) =>
      isStageKind(format.formatName)
        ? [
            {
              kind: format.formatName,
              formatId: format.formatId,
              categoryName: category.name,
              stageName: format.aliasName || format.formatName,
              isEnded: format.isEnded ?? null,
            },
          ]
        : []
    )
  );
};
