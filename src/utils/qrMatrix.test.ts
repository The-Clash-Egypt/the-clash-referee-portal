import { qrModules, qrPathData } from "./qrMatrix";

const GUEST_URL =
  "https://referee.example.com/match/shared?matchId=3f2504e0-4f89-11d3-9a0c-0305e82c3301&token=1789123456.AbCdEfGhIjKlMnOpQrStUv";

const finderAt = (modules: boolean[][], top: number, left: number) =>
  [0, 6].every((edge) =>
    [0, 1, 2, 3, 4, 5, 6].every((i) => modules[top + edge][left + i] && modules[top + i][left + edge])
  ) && !modules[top + 1][left + 1] && modules[top + 3][left + 3];

describe("qrModules", () => {
  it("returns a square matrix of a valid QR size", () => {
    const modules = qrModules(GUEST_URL);
    const size = modules.length;

    expect(modules.every((row) => row.length === size)).toBe(true);
    expect(size).toBeGreaterThanOrEqual(21);
    expect((size - 17) % 4).toBe(0);
  });

  it("draws the three finder patterns", () => {
    const modules = qrModules(GUEST_URL);
    const size = modules.length;

    expect(finderAt(modules, 0, 0)).toBe(true);
    expect(finderAt(modules, 0, size - 7)).toBe(true);
    expect(finderAt(modules, size - 7, 0)).toBe(true);
  });

  it("stays sparse enough to print small: a full guest link fits version 8 at level M", () => {
    expect(qrModules(GUEST_URL, "M").length).toBeLessThanOrEqual(49);
    expect(qrModules(GUEST_URL, "H").length).toBeGreaterThan(qrModules(GUEST_URL, "M").length);
  });
});

describe("qrPathData", () => {
  it("merges each row's dark runs into single rectangles", () => {
    expect(qrPathData([[true, true, false, true]])).toBe("M0 0h2v1h-2zM3 0h1v1h-1z");
  });

  it("puts rows on their own y coordinate", () => {
    expect(qrPathData([[false], [true]])).toBe("M0 1h1v1h-1z");
  });

  it("returns an empty path for an all-light matrix", () => {
    expect(qrPathData([[false, false]])).toBe("");
  });
});
