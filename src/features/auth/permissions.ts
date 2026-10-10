import { AdminRole } from "./types/adminRoles";

/**
 * Full access to a tournament's matches: Select mode, referee assignment, editing, QR codes, Courts and day durations.
 * Superadmins and referee admins have it; everyone else is a plain referee who sees and scores only their own matches.
 */
export const hasFullAccess = (user?: { adminRoles?: AdminRole[] } | null): boolean =>
  !!user?.adminRoles?.some((role) => role === AdminRole.SUPERADMIN || role === AdminRole.REFEREE_ADMIN);
