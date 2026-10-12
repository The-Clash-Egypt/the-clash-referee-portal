import api from "../../../api/axios";
import { finishAmericano, getAmericanoMatches } from "./americano";

jest.mock("../../../api/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const get = api.get as jest.Mock;
const post = api.post as jest.Mock;

const envelope = <T>(data: T) => ({ data: { data, success: true, message: "" } });

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

it("reads an Americano stage's schedule", async () => {
  const matches = [{ id: "x1", round: "Round 1", isCompleted: true, gameScores: [] }];
  get.mockResolvedValue(envelope(matches));

  await expect(getAmericanoMatches("f 1")).resolves.toEqual(matches);
  expect(get).toHaveBeenCalledWith("/Americano/matches?formatId=f%201");
});

it("reads a stage without matches as an empty schedule", async () => {
  get.mockResolvedValue(envelope(null));

  await expect(getAmericanoMatches("f1")).resolves.toEqual([]);
});

it("finishes a stage early and returns what it did", async () => {
  post.mockResolvedValue(envelope({ roundsPlayed: 3, matchesRemoved: 8 }));

  await expect(finishAmericano("f1")).resolves.toEqual({ roundsPlayed: 3, matchesRemoved: 8 });
  expect(post).toHaveBeenCalledWith("/Americano/finish?formatId=f1");
});
