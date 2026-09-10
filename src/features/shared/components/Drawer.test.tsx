import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Drawer, { DRAWER_EXIT_MS } from "./Drawer";

afterEach(() => {
  jest.useRealTimers();
  document.body.style.overflow = "";
});

const open = (props: Partial<React.ComponentProps<typeof Drawer>> = {}) => {
  const onClose = jest.fn();
  const utils = render(
    <Drawer isOpen onClose={onClose} title="Edit match" {...props}>
      <p>Body text</p>
    </Drawer>
  );
  return { ...utils, onClose };
};

it("renders nothing while closed", () => {
  render(<Drawer isOpen={false} onClose={jest.fn()} title="Edit match">Body text</Drawer>);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("shows a labelled dialog with its content when open", () => {
  open({ subtitle: "Court 1" });
  expect(screen.getByRole("dialog", { name: "Edit match" })).toBeInTheDocument();
  expect(screen.getByText("Body text")).toBeInTheDocument();
  expect(screen.getByText("Court 1")).toBeInTheDocument();
});

it("closes on Escape, on the close button and on the backdrop", () => {
  const { onClose } = open();
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  fireEvent.click(document.querySelector(".drawer-overlay") as Element);
  expect(onClose).toHaveBeenCalledTimes(3);
});

it("ignores backdrop clicks when asked to", () => {
  const { onClose } = open({ closeOnOverlayClick: false });
  fireEvent.click(document.querySelector(".drawer-overlay") as Element);
  expect(onClose).not.toHaveBeenCalled();
});

it("keeps its last content on screen while sliding out, then unmounts", () => {
  jest.useFakeTimers();
  const { rerender } = render(
    <Drawer isOpen onClose={jest.fn()} title="Edit match">
      <p>Body text</p>
    </Drawer>
  );

  rerender(<Drawer isOpen={false} onClose={jest.fn()} title="Edit match">{null}</Drawer>);
  expect(screen.getByText("Body text")).toBeInTheDocument();
  expect(document.querySelector(".drawer-root--closing")).not.toBeNull();

  act(() => {
    jest.advanceTimersByTime(DRAWER_EXIT_MS);
  });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("is inert while sliding out, so its last content can't be used", () => {
  jest.useFakeTimers();
  const onClose = jest.fn();
  const { rerender } = render(
    <Drawer isOpen onClose={onClose} title="Edit match">
      <button>Save</button>
    </Drawer>
  );
  const panel = screen.getByRole("dialog");
  expect(panel).not.toHaveAttribute("inert");

  rerender(<Drawer isOpen={false} onClose={onClose} title="Edit match">{null}</Drawer>);
  // The frozen Save is still on screen, but the panel is inert and the root takes no clicks.
  expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  expect(panel).toHaveAttribute("inert");
  // eslint-disable-next-line testing-library/no-node-access -- pointer-events: none hangs off the root's class
  expect(document.querySelector(".drawer-root")).toHaveClass("drawer-root--closing");

  // Re-opened before the slide-out ends: usable again.
  rerender(
    <Drawer isOpen onClose={onClose} title="Edit match">
      <button>Save</button>
    </Drawer>
  );
  expect(screen.getByRole("dialog")).not.toHaveAttribute("inert");
  // eslint-disable-next-line testing-library/no-node-access -- see above
  expect(document.querySelector(".drawer-root")).not.toHaveClass("drawer-root--closing");
});

it("locks page scroll while open and restores it afterwards", () => {
  jest.useFakeTimers();
  document.body.style.overflow = "auto";
  const { rerender } = render(<Drawer isOpen onClose={jest.fn()} title="Edit match">x</Drawer>);
  expect(document.body.style.overflow).toBe("hidden");

  rerender(<Drawer isOpen={false} onClose={jest.fn()} title="Edit match">x</Drawer>);
  act(() => {
    jest.advanceTimersByTime(DRAWER_EXIT_MS);
  });
  expect(document.body.style.overflow).toBe("auto");
});

it("moves focus into the drawer and hands it back on close", () => {
  jest.useFakeTimers();
  const Harness: React.FC<{ isOpen: boolean }> = ({ isOpen }) => (
    <>
      <button>Opener</button>
      <Drawer isOpen={isOpen} onClose={jest.fn()} title="Edit match">x</Drawer>
    </>
  );
  const { rerender } = render(<Harness isOpen={false} />);
  screen.getByRole("button", { name: "Opener" }).focus();

  rerender(<Harness isOpen />);
  expect(screen.getByRole("dialog")).toHaveFocus();

  rerender(<Harness isOpen={false} />);
  act(() => {
    jest.advanceTimersByTime(DRAWER_EXIT_MS);
  });
  expect(screen.getByRole("button", { name: "Opener" })).toHaveFocus();
});

it("offers a wide size for big sheets", () => {
  open({ size: "lg" });
  expect(screen.getByRole("dialog")).toHaveClass("drawer--lg");
});
