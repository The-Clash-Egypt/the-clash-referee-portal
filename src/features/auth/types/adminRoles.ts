export enum AdminRole {
  REFEREE_ADMIN = 0,
  REGISTRATION_MANAGER = 1,
  SUPERADMIN = 2,
  BRACKET_MANAGER = 3,
}

export const AdminRoleLabels: Record<AdminRole, string> = {
  [AdminRole.REFEREE_ADMIN]: "Referee Admin",
  [AdminRole.REGISTRATION_MANAGER]: "Registration Manager",
  [AdminRole.SUPERADMIN]: "Superadmin",
  [AdminRole.BRACKET_MANAGER]: "Bracket Manager",
};

