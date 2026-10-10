import { TeamMember } from "../../types/match";
import { shortPersonName } from "../../utils/matchDisplay";

/**
 * A side's players as the score dialog has always listed them: up to three, the captain marked only when there are
 * more. `short` gives "Ali H." for the scoreboard, where room is tight.
 */
export const featuredPlayers = (members?: TeamMember[] | null, { short = false }: { short?: boolean } = {}): string => {
  const list = members ?? [];
  const hasMore = list.length > 3;
  return list
    .slice(0, 3)
    .map((member) => {
      const fullName = `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim();
      const name = short ? shortPersonName(fullName) : fullName;
      return name && hasMore && member.isCaptain ? `${name} (C)` : name;
    })
    .filter(Boolean)
    .join(" · ");
};
