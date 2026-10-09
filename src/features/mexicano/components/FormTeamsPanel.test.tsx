import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import FormTeamsPanel from "./FormTeamsPanel";

const unpaired = [
  { memberId: "m1", name: "Ali Hassan" },
  { memberId: "m2", name: "Bea Samir" },
  { memberId: "m3", name: "Cy Nabil" },
];

const renderPanel = (props: Partial<React.ComponentProps<typeof FormTeamsPanel>> = {}) => {
  const onCreate = jest.fn();
  const utils = render(<FormTeamsPanel unitSize={2} unpaired={unpaired} busy={false} onCreate={onCreate} {...props} />);
  return { onCreate, ...utils };
};

it("enables Make team only when exactly unitSize players are picked", () => {
  renderPanel();
  const make = screen.getByRole("button", { name: "Make team" });
  expect(make).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Ali Hassan" }));
  expect(make).toBeDisabled();
  expect(screen.getByText(/1 of 2 picked/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Bea Samir" }));
  expect(make).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Cy Nabil" })); // a third pick is ignored
  expect(screen.getByText(/2 of 2 picked/)).toBeInTheDocument();
});

it("sends the picked member ids and clears the pick once they leave the pool", () => {
  const { onCreate, rerender } = renderPanel();
  fireEvent.click(screen.getByRole("button", { name: "Ali Hassan" }));
  fireEvent.click(screen.getByRole("button", { name: "Cy Nabil" }));
  fireEvent.click(screen.getByRole("button", { name: "Make team" }));
  expect(onCreate).toHaveBeenCalledWith(["m1", "m3"]);

  rerender(<FormTeamsPanel unitSize={2} unpaired={[unpaired[1]]} busy={false} onCreate={onCreate} />);
  expect(screen.getByText(/0 of 2 picked/)).toBeInTheDocument();
});

it("filters the pool by search and says when nobody is left", () => {
  const { rerender } = renderPanel();
  fireEvent.change(screen.getByRole("searchbox", { name: "Search players to team up" }), { target: { value: "bea" } });
  expect(screen.queryByRole("button", { name: "Ali Hassan" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Bea Samir" })).toBeInTheDocument();
  rerender(<FormTeamsPanel unitSize={2} unpaired={[]} busy={false} onCreate={jest.fn()} />);
  expect(screen.getByText("Everyone is in a team.")).toBeInTheDocument();
});

it("disables everything while busy", () => {
  renderPanel({ busy: true });
  expect(screen.getByRole("button", { name: "Ali Hassan" })).toBeDisabled();
});
