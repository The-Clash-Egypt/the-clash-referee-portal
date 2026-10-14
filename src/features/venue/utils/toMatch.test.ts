import { venueMatchToMatch } from "./toMatch";
import { VenueMatch } from "../types/venue";

const venueMatch = (over: Partial<VenueMatch> = {}): VenueMatch => ({
  id: "m1",
  categoryName: "Men's Open",
  formatName: "Pool A",
  formatType: "Group",
  round: "Round 1",
  startTime: "2026-10-10T15:20:00Z",
  venue: "Court 1",
  homeTeamId: "t1",
  homeTeamName: "Sand Sharks",
  awayTeamId: "t2",
  awayTeamName: "Blue Wave",
  bestOf: 3,
  winnerTeamId: "",
  homeTeamSets: 1,
  awayTeamSets: 0,
  isCompleted: false,
  gameScores: [{ gameNumber: 1, homeScore: 21, awayScore: 18 }],
  homeTeamPlayers: [],
  awayTeamPlayers: [],
  ...over,
});

it("maps a court's match onto the portal's Match", () => {
  expect(venueMatchToMatch(venueMatch())).toEqual({
    id: "m1",
    venue: "Court 1",
    tournamentName: undefined,
    categoryName: "Men's Open",
    format: "Pool A",
    formatType: "Group",
    bestOf: 3,
    pointsPerMatch: null,
    startTime: "2026-10-10T15:20:00Z",
    round: "Round 1",
    homeTeamId: "t1",
    homeTeamName: "Sand Sharks",
    awayTeamId: "t2",
    awayTeamName: "Blue Wave",
    homeTeam2Id: null,
    homeTeam2Name: null,
    awayTeam2Id: null,
    awayTeam2Name: null,
    homeScore: 1,
    awayScore: 0,
    gameScores: [{ gameNumber: 1, homeScore: 21, awayScore: 18 }],
    referees: [],
    homeExtraUnits: [],
    awayExtraUnits: [],
    homeTeamMembers: [],
    awayTeamMembers: [],
    isCompleted: false,
  });
});

it("keeps every unit of a Roulette side (units 3+ in slot order)", () => {
  const extras = [
    { teamId: "t5", teamName: "Eve" },
    { teamId: "t6", teamName: "Fay" },
  ];
  const match = venueMatchToMatch(
    venueMatch({ formatType: "Roulette", homeExtraUnits: extras, awayExtraUnits: [{ teamId: "t7", teamName: "Gus" }] })
  );

  expect(match.homeExtraUnits).toEqual(extras);
  expect(match.awayExtraUnits).toEqual([{ teamId: "t7", teamName: "Gus" }]);
});

it("names the format by its type when the stage has no name", () => {
  expect(venueMatchToMatch(venueMatch({ formatName: "" })).format).toBe("Group");
});

it("keeps both players of each side and the points target of an Americano match", () => {
  const match = venueMatchToMatch(
    venueMatch({
      formatType: "Americano",
      pointsPerMatch: 21,
      homeTeam2Id: "t3",
      homeTeam2Name: "Karim",
      awayTeam2Id: "t4",
      awayTeam2Name: "Omar",
    })
  );

  expect(match).toEqual(
    expect.objectContaining({
      pointsPerMatch: 21,
      homeTeam2Id: "t3",
      homeTeam2Name: "Karim",
      awayTeam2Id: "t4",
      awayTeam2Name: "Omar",
    })
  );
});

// The court page gets names only (no ids, nationality or notes), so the member ids are synthetic,
// as on the match QR page.
it("turns the players into team members, the captain marked", () => {
  const match = venueMatchToMatch(
    venueMatch({
      homeTeamPlayers: [
        { firstName: "Ali", lastName: "Hassan", isCaptain: true },
        { firstName: "Karim", lastName: "Adel", isCaptain: false },
      ],
      awayTeamPlayers: [{ firstName: "Omar", lastName: "Nabil", isCaptain: false }],
    })
  );

  expect(match.homeTeamMembers?.map((member) => member.id)).toEqual(["home-0", "home-1"]);
  expect(match.homeTeamMembers?.[0]).toEqual(
    {
      id: "home-0",
      teamMemberId: "home-0",
      playerId: "",
      isCaptain: true,
      firstName: "Ali",
      lastName: "Hassan",
      nationality: "",
      gender: "",
      registrationStatus: "",
      paymentStatus: "",
      consent: false,
      addedAt: "",
      phoneNumber: "",
      email: "",
    }
  );
  expect(match.awayTeamMembers?.[0]).toEqual(expect.objectContaining({ id: "away-0", firstName: "Omar", isCaptain: false }));
});

it("leaves the members empty when the court sends no players", () => {
  const match = venueMatchToMatch(venueMatch({ homeTeamPlayers: undefined, awayTeamPlayers: undefined }));

  expect(match.homeTeamMembers).toEqual([]);
  expect(match.awayTeamMembers).toEqual([]);
});

it("copies the set scores rather than sharing them with the court's data", () => {
  const source = venueMatch();
  const match = venueMatchToMatch(source);

  expect(match.gameScores).toEqual(source.gameScores);
  expect(match.gameScores).not.toBe(source.gameScores);
});
