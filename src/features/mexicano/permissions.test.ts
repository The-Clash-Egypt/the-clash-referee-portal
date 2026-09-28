import { canRunMexicano } from "./permissions";
import { AdminRole } from "../auth/types/adminRoles";

it("lets the roles in the backend's MexicanoRunPolicy run the event", () => {
  for (const role of [AdminRole.REFEREE_ADMIN, AdminRole.SUPERADMIN, AdminRole.BRACKET_MANAGER, AdminRole.TOURNAMENT_MANAGER]) {
    expect(canRunMexicano({ adminRoles: [role] })).toBe(true);
  }
});

it("keeps plain referees and other admins to entering scores", () => {
  expect(canRunMexicano({ adminRoles: [] })).toBe(false);
  expect(canRunMexicano({ adminRoles: [AdminRole.REGISTRATION_MANAGER] })).toBe(false);
  expect(canRunMexicano({})).toBe(false);
  expect(canRunMexicano(null)).toBe(false);
});

it("uses the backend's number for TournamentManager", () => {
  expect(AdminRole.TOURNAMENT_MANAGER).toBe(7);
});
