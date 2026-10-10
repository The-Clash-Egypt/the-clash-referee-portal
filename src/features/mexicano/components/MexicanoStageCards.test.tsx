import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import MexicanoStageCards from "./MexicanoStageCards";
import { getMexicanoSession, getMexicanoStages } from "../api/mexicano";

jest.mock("../../../api/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("../api/mexicano", () => ({
  ...jest.requireActual("../api/mexicano"),
  getMexicanoStages: jest.fn(),
  getMexicanoSession: jest.fn(),
}));

const stages = getMexicanoStages as jest.Mock;
const load = getMexicanoSession as jest.Mock;

beforeEach(() => jest.resetAllMocks());

it("shows a card per Mexicano stage with where it stands, and opens it on tap", async () => {
  stages.mockResolvedValue([
    { formatId: "m1", categoryName: "Men's Open", stageName: "Evening" },
    { formatId: "m2", categoryName: "Mixed", stageName: "Mexicano" },
  ]);
  load.mockImplementation((formatId: string) =>
    formatId === "m1"
      ? Promise.resolve({ currentRound: 3, plannedRounds: 8, currentRoundScored: 4, currentRoundTotal: 4, ended: false })
      : Promise.reject(new Error("Network Error"))
  );
  const onOpen = jest.fn();

  render(<MexicanoStageCards tournamentId="t1" onOpen={onOpen} />);

  expect(await screen.findByText("Men's Open")).toBeInTheDocument();
  const evening = screen.getByRole("button", { name: /Men's Open/ });
  expect(within(evening).getByText("Evening")).toBeInTheDocument();
  expect(within(evening).getByText("Round 3 of 8")).toBeInTheDocument();
  expect(within(evening).getByText("Ready for next round")).toBeInTheDocument();
  expect(screen.getByText("Tap to open")).toBeInTheDocument(); // its session didn't load: still reachable
  fireEvent.click(screen.getByRole("button", { name: /Mixed/ }));
  expect(onOpen).toHaveBeenCalledWith("m2");
  expect(stages).toHaveBeenCalledWith("t1");
});

it("renders nothing for a tournament without a Mexicano stage", async () => {
  stages.mockResolvedValue([]);

  const { container } = render(<MexicanoStageCards tournamentId="t1" onOpen={jest.fn()} />);
  await waitFor(() => expect(stages).toHaveBeenCalledWith("t1"));

  expect(container).toBeEmptyDOMElement();
  expect(load).not.toHaveBeenCalled();
});

it("shows the loading placeholder it is given until the stages are in", async () => {
  let answer: (value: unknown[]) => void = () => {};
  stages.mockReturnValue(new Promise((resolve) => (answer = resolve)));

  const { container } = render(
    <MexicanoStageCards tournamentId="t1" onOpen={jest.fn()} loading={<p>Loading Mexicano...</p>} />
  );
  expect(screen.getByText("Loading Mexicano...")).toBeInTheDocument();

  answer([]);
  await waitFor(() => expect(container).toBeEmptyDOMElement());
});
