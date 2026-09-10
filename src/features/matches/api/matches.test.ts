import api from "../../../api/axios";
import { UnknownMatchFormatError, updateMatchByFormat } from "./matches";

jest.mock("../../../api/axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(() => Promise.resolve({ data: { success: true } })),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const put = api.put as jest.Mock;

beforeEach(() => put.mockClear());

describe("updateMatchByFormat", () => {
  it.each([
    ["Group", "/Group/match/m1"],
    ["League", "/League/match/m1"],
    ["Knockout", "/Knockout/match/m1"],
    ["Americano", "/Americano/match/m1"],
    ["Mexicano", "/Mexicano/match/m1"],
  ])("saves %s matches through %s", async (formatType, url) => {
    await updateMatchByFormat(formatType, "m1", { gameScores: [] });
    expect(put).toHaveBeenCalledWith(url, { gameScores: [] });
  });

  it("refuses an unknown format instead of guessing", async () => {
    await expect(updateMatchByFormat("Group A", "m1", { gameScores: [] })).rejects.toBeInstanceOf(
      UnknownMatchFormatError
    );
    await expect(updateMatchByFormat(undefined, "m1", { gameScores: [] })).rejects.toThrow(
      'Cannot save scores: unknown match format "".'
    );
    expect(put).not.toHaveBeenCalled();
  });

  it("is not fooled by object-prototype names", async () => {
    await expect(updateMatchByFormat("toString", "m1", { gameScores: [] })).rejects.toBeInstanceOf(
      UnknownMatchFormatError
    );
  });
});
