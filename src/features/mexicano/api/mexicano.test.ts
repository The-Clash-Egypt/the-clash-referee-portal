import api from "../../../api/axios";
import {
  finishMexicano,
  getMexicanoSession,
  getMexicanoStages,
  mexicanoErrorMessage,
  startNextMexicanoRound,
  undoMexicanoRound,
  updateMexicanoPlayers,
} from "./mexicano";
import { MexicanoSession, MexicanoStatus } from "../types";

jest.mock("../../../api/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const get = api.get as jest.Mock;
const post = api.post as jest.Mock;
const put = api.put as jest.Mock;
const del = api.delete as jest.Mock;

const envelope = <T>(data: T) => ({ data: { data, success: true, message: "" } });
const session = { formatId: "f1", currentRound: 2 } as MexicanoSession;

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  put.mockReset();
  del.mockReset();
});

describe("Mexicano session actions", () => {
  it("reads the session for a stage", async () => {
    get.mockResolvedValue(envelope(session));

    await expect(getMexicanoSession("f 1")).resolves.toEqual(session);
    expect(get).toHaveBeenCalledWith("/Mexicano/session?formatId=f%201");
  });

  it("sends status changes as the server's numbers and returns the new session", async () => {
    put.mockResolvedValue(envelope(session));

    await expect(updateMexicanoPlayers("f1", [{ teamId: "t1", status: MexicanoStatus.SitOut }])).resolves.toEqual(session);
    expect(put).toHaveBeenCalledWith("/Mexicano/players?formatId=f1", [{ teamId: "t1", status: 2 }]);
  });

  it("starts, undoes and finishes rounds through their own routes", async () => {
    post.mockResolvedValue(envelope(session));
    del.mockResolvedValue(envelope(session));

    await expect(startNextMexicanoRound("f1")).resolves.toEqual(session);
    await expect(undoMexicanoRound("f1")).resolves.toEqual(session);
    await expect(finishMexicano("f1")).resolves.toEqual(session);

    expect(post).toHaveBeenNthCalledWith(1, "/Mexicano/next-round?formatId=f1");
    expect(del).toHaveBeenCalledWith("/Mexicano/round?formatId=f1");
    expect(post).toHaveBeenNthCalledWith(2, "/Mexicano/finish?formatId=f1");
  });
});

describe("getMexicanoStages", () => {
  it("lists only the tournament's Mexicano stages with their category", async () => {
    get.mockResolvedValue(
      envelope({
        categories: [
          {
            name: "Men's Open",
            formats: [
              { formatId: "g1", formatName: "Group", aliasName: "", order: 1 },
              { formatId: "m1", formatName: "Mexicano", aliasName: "Evening", order: 2 },
            ],
          },
          { name: "Mixed", formats: [{ formatId: "m2", formatName: "Mexicano", aliasName: null, order: 1 }] },
        ],
      })
    );

    await expect(getMexicanoStages("t1")).resolves.toEqual([
      { formatId: "m1", categoryName: "Men's Open", stageName: "Evening" },
      { formatId: "m2", categoryName: "Mixed", stageName: "Mexicano" },
    ]);
    expect(get).toHaveBeenCalledWith("/Tournament/t1/formats");
  });

  it("copes with a tournament that has no categories", async () => {
    get.mockResolvedValue(envelope(null));

    await expect(getMexicanoStages("t1")).resolves.toEqual([]);
  });
});

describe("mexicanoErrorMessage", () => {
  it("prefers the server's reason and falls back otherwise", () => {
    const refused = { response: { data: { message: "1 match in Round 1 still needs a score." } } };

    expect(mexicanoErrorMessage(refused, "Could not start the round.")).toBe("1 match in Round 1 still needs a score.");
    expect(mexicanoErrorMessage(new Error("Network Error"), "Could not start the round.")).toBe(
      "Could not start the round."
    );
  });
});
