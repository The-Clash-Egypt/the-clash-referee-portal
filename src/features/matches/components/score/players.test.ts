import { TeamMember } from "../../types/match";
import { featuredPlayers } from "./players";

const member = (firstName: string, lastName: string, isCaptain = false): TeamMember =>
  ({ id: `${firstName}-${lastName}`, firstName, lastName, isCaptain }) as TeamMember;

test("a pair is listed in full, without marking the captain", () => {
  expect(featuredPlayers([member("Ali", "Hassan", true), member("Karim", "Mostafa")])).toBe("Ali Hassan · Karim Mostafa");
});

test("a bigger team shows its first three, with the captain marked", () => {
  const team = [
    member("Omar", "Nabil"),
    member("Youssef", "Adel"),
    member("Tarek", "Samy", true),
    member("Samir", "Ali"),
    member("Ziad", "Tamer"),
  ];
  expect(featuredPlayers(team)).toBe("Omar Nabil · Youssef Adel · Tarek Samy (C)");
});

test("the scoreboard's short form", () => {
  expect(featuredPlayers([member("Ali", "Hassan"), member("Karim", "Mostafa")], { short: true })).toBe(
    "Ali H. · Karim M."
  );
  expect(featuredPlayers(undefined)).toBe("");
});
