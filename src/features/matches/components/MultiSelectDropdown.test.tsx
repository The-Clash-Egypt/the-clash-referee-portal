import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MultiSelectDropdown from "./MultiSelectDropdown";

const VENUES = ["Court 1", "Court 2", "Court 3"];

const setup = (value: string[] = []) => {
  const onChange = jest.fn();
  render(
    <MultiSelectDropdown
      options={VENUES}
      value={value}
      onChange={onChange}
      allLabel="All Venues"
      itemNoun="venues"
    />
  );
  return { onChange };
};

const openMenu = () => fireEvent.click(screen.getByRole("button", { expanded: false }));
const tick = (name: string) => fireEvent.click(screen.getByRole("option", { name }));

describe("MultiSelectDropdown", () => {
  it("does not notify the parent while the menu is open", () => {
    const { onChange } = setup();
    openMenu();

    tick("Court 1");
    tick("Court 3");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("notifies once, with the whole selection, when Done is clicked", () => {
    const { onChange } = setup();
    openMenu();
    tick("Court 1");
    tick("Court 3");

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(["Court 1", "Court 3"]);
  });

  it("commits when the menu is closed by clicking outside", () => {
    const { onChange } = setup();
    openMenu();
    tick("Court 2");

    fireEvent.mouseDown(document.body);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(["Court 2"]);
  });

  it("commits when the menu is closed with Escape", () => {
    const { onChange } = setup();
    openMenu();
    tick("Court 2");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onChange).toHaveBeenCalledWith(["Court 2"]);
  });

  it("stays silent when the selection is unchanged", () => {
    const { onChange } = setup(["Court 1"]);
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("stays silent when a tick is undone before closing", () => {
    const { onChange } = setup();
    openMenu();
    tick("Court 1");
    tick("Court 1");

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows the pending selection on the trigger while the menu is open", () => {
    setup();
    openMenu();
    tick("Court 1");
    tick("Court 2");

    expect(screen.getByRole("button", { expanded: true })).toHaveTextContent("2 venues");
  });

  it("clears the pending selection without notifying until closed", () => {
    const { onChange } = setup(["Court 1", "Court 2"]);
    openMenu();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("reseeds from the applied value each time it opens", () => {
    const { onChange } = setup(["Court 1"]);
    openMenu();
    tick("Court 2");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onChange).toHaveBeenCalledWith(["Court 1", "Court 2"]);

    // Parent kept value at ["Court 1"], so reopening must show that, not the draft.
    openMenu();
    expect(screen.getByRole("option", { name: "Court 2" })).toHaveAttribute("aria-selected", "false");
  });
});
