import { AdminRole } from "../auth/types/adminRoles";
import { User } from "../../store/slices/userSlice";

const RUN_ROLES = [AdminRole.REFEREE_ADMIN, AdminRole.SUPERADMIN, AdminRole.BRACKET_MANAGER, AdminRole.TOURNAMENT_MANAGER];

/**
 * Who can check players in and start, undo or finish rounds. Mirrors the backend's
 * MexicanoRunPolicy (spec 2026-09-29 §3.1); everyone else only enters scores.
 */
export const canRunMexicano = (user: Pick<User, "adminRoles"> | null | undefined): boolean =>
  !!user?.adminRoles?.some((role) => RUN_ROLES.includes(role));
