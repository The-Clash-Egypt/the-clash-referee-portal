import { stagesLabel } from "./stages";

jest.mock("../../api/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

it("names the stages tab after its one kind of stage, else Stages", () => {
  expect(stagesLabel([{ kind: "Mexicano" }, { kind: "Mexicano" }])).toBe("Mexicano");
  expect(stagesLabel([{ kind: "Americano" }])).toBe("Americano");
  expect(stagesLabel([{ kind: "Americano" }, { kind: "Mexicano" }])).toBe("Stages");
  expect(stagesLabel([])).toBe("Stages");
});
