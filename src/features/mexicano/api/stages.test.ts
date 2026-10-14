import api from "../../../api/axios";
import { getTournamentStages } from "./stages";

jest.mock("../../../api/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const get = api.get as jest.Mock;

const envelope = <T>(data: T) => ({ data: { data, success: true, message: "" } });

beforeEach(() => get.mockReset());

it("lists the tournament's Americano and Mexicano stages in order, with their category and whether they ended", async () => {
  get.mockResolvedValue(
    envelope({
      categories: [
        {
          name: "Men's Open",
          formats: [
            { formatId: "g1", formatName: "Group", aliasName: "", order: 1, isEnded: null },
            { formatId: "m1", formatName: "Mexicano", aliasName: "Evening", order: 2, isEnded: false },
            { formatId: "a1", formatName: "Americano", aliasName: "", order: 3, isEnded: true },
          ],
        },
        { name: "Mixed", formats: [{ formatId: "m2", formatName: "Mexicano", aliasName: null, order: 1 }] },
      ],
    })
  );

  await expect(getTournamentStages("t 1")).resolves.toEqual([
    { kind: "Mexicano", formatId: "m1", categoryName: "Men's Open", stageName: "Evening", isEnded: false },
    { kind: "Americano", formatId: "a1", categoryName: "Men's Open", stageName: "Americano", isEnded: true },
    { kind: "Mexicano", formatId: "m2", categoryName: "Mixed", stageName: "Mexicano", isEnded: null },
  ]);
  expect(get).toHaveBeenCalledTimes(1);
  expect(get).toHaveBeenCalledWith("/Tournament/t%201/formats");
});

it("copes with a tournament that has no categories", async () => {
  get.mockResolvedValue(envelope(null));

  await expect(getTournamentStages("t1")).resolves.toEqual([]);
});

it("lists Roulette stages too", async () => {
  get.mockResolvedValue(
    envelope({
      categories: [
        {
          name: "Open",
          formats: [
            { formatId: "r1", formatName: "Roulette", aliasName: null, order: 1, isEnded: false },
            { formatId: "k1", formatName: "Knockout", aliasName: null, order: 2, isEnded: null },
          ],
        },
      ],
    })
  );

  await expect(getTournamentStages("t1")).resolves.toEqual([
    { kind: "Roulette", formatId: "r1", categoryName: "Open", stageName: "Roulette", isEnded: false },
  ]);
});
