import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import VenueList from "./VenueList";
import { Venue } from "../types/venue";

const court = (id: string, name: string, fields: Partial<Venue> = {}): Venue => ({
  id,
  name,
  isLocked: false,
  tournamentId: "t1",
  createdAt: "2026-10-05T10:00:00",
  password: null,
  accessToken: `token-${id}`,
  accessTokenExpiry: null,
  totalMatchCount: 18,
  completedMatchCount: 12,
  ...fields,
});

const venues = [
  court("v2", "Court 2", { isLocked: true, totalMatchCount: 15, completedMatchCount: 9 }),
  court("v1", "Court 1", { password: "4821" }),
  court("v10", "Court 10", { password: "1188", isLocked: true, accessToken: null }),
];

const renderList = (props: Partial<React.ComponentProps<typeof VenueList>> = {}) => {
  const handlers = { onUpdate: jest.fn(), onShare: jest.fn(), onShowQRCode: jest.fn(), onForceGenerateToken: jest.fn() };
  render(<VenueList venues={venues} {...handlers} {...props} />);
  return handlers;
};

const courtNames = () => screen.queryAllByRole("article").map((card) => card.getAttribute("aria-label"));
const card = (name: string) => screen.getByRole("article", { name });

it("lists the courts in court order and filters them with the chips", () => {
  renderList();
  const chips = within(screen.getByRole("group", { name: "Filter courts" }));
  expect(courtNames()).toEqual(["Court 1", "Court 2", "Court 10"]);
  expect(chips.getByRole("button", { name: "All 3" })).toHaveAttribute("aria-pressed", "true");

  fireEvent.click(chips.getByRole("button", { name: "Locked" }));
  expect(courtNames()).toEqual(["Court 2", "Court 10"]);
  expect(chips.getByRole("button", { name: "All 3" })).toHaveAttribute("aria-pressed", "false");

  fireEvent.click(chips.getByRole("button", { name: "Has password" }));
  expect(courtNames()).toEqual(["Court 10"]);

  // Locked and Open take turns; Has password stays on.
  fireEvent.click(chips.getByRole("button", { name: "Open" }));
  expect(courtNames()).toEqual(["Court 1"]);

  fireEvent.click(chips.getByRole("button", { name: "All 3" }));
  expect(courtNames()).toEqual(["Court 1", "Court 2", "Court 10"]);
  expect(chips.getByRole("button", { name: "Has password" })).toHaveAttribute("aria-pressed", "false");
});

it("says when no court matches the chips, and clears them", () => {
  renderList({ venues: [venues[1]] });

  fireEvent.click(within(screen.getByRole("group", { name: "Filter courts" })).getByRole("button", { name: "Locked" }));
  expect(screen.getByText("No courts match your filters")).toBeInTheDocument();
  expect(courtNames()).toEqual([]);

  fireEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
  expect(courtNames()).toEqual(["Court 1"]);
});

it("shows each court's progress and masks its password until asked", () => {
  renderList();
  const one = card("Court 1");
  expect(within(one).getByText("12 of 18 done")).toBeInTheDocument();
  expect(within(one).queryByText("4821")).not.toBeInTheDocument();

  fireEvent.click(within(one).getByRole("button", { name: "Show password" }));
  expect(within(one).getByText("4821")).toBeInTheDocument();
  expect(within(card("Court 2")).getByText("No password")).toBeInTheDocument();
});

it("locks, renames and sets the password with today's payloads", () => {
  const { onUpdate } = renderList();

  fireEvent.click(within(card("Court 2")).getByRole("button", { name: "Locked" }));
  expect(onUpdate).toHaveBeenLastCalledWith("v2", { name: "Court 2", isLocked: false });

  fireEvent.click(within(card("Court 1")).getByRole("button", { name: "Rename Court 1" }));
  const name = within(card("Court 1")).getByRole("textbox", { name: "Court name" });
  fireEvent.change(name, { target: { value: "  Centre Court  " } });
  fireEvent.keyDown(name, { key: "Enter" });
  expect(onUpdate).toHaveBeenLastCalledWith("v1", { name: "Centre Court", isLocked: false });

  fireEvent.click(within(card("Court 2")).getByRole("button", { name: "Password" }));
  fireEvent.change(within(card("Court 2")).getByRole("textbox", { name: "Password" }), { target: { value: "7310" } });
  fireEvent.click(within(card("Court 2")).getByRole("button", { name: "Save password" }));
  expect(onUpdate).toHaveBeenLastCalledWith("v2", { name: "Court 2", password: "7310", isLocked: true });
  expect(onUpdate).toHaveBeenCalledTimes(3);
});

it("opens the QR, shares, and makes a new link from ⋯ (only for a court that has a link)", () => {
  const { onShowQRCode, onShare, onForceGenerateToken } = renderList();
  const one = card("Court 1");

  fireEvent.click(within(one).getByRole("button", { name: "QR" }));
  expect(onShowQRCode).toHaveBeenCalledWith(venues[1]);
  fireEvent.click(within(one).getByRole("button", { name: "Share" }));
  expect(onShare).toHaveBeenCalledWith(venues[1]);

  const more = within(one).getByRole("button", { name: "More for Court 1" });
  expect(more).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(more);
  expect(more).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(within(one).getByRole("button", { name: /new link/i }));
  expect(onForceGenerateToken).toHaveBeenCalledWith(venues[1]);
  expect(more).toHaveAttribute("aria-expanded", "false");

  // No link yet (QR and Share make one): ⋯ only renames.
  const ten = card("Court 10");
  fireEvent.click(within(ten).getByRole("button", { name: "More for Court 10" }));
  expect(within(ten).queryByRole("button", { name: /new link/i })).not.toBeInTheDocument();
  fireEvent.click(within(ten).getByRole("button", { name: "Rename" }));
  expect(within(ten).getByRole("textbox", { name: "Court name" })).toHaveValue("Court 10");
});

it("says so when there are no courts", () => {
  renderList({ venues: [] });
  expect(screen.getByText("No courts found")).toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Filter courts" })).not.toBeInTheDocument();
});

it("flags a court whose link has expired or expires within hours, and keeps healthy links quiet", () => {
  const inHours = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  renderList({
    venues: [
      court("v1", "Court 1", { accessTokenExpiry: inHours(-1) }),
      court("v2", "Court 2", { accessTokenExpiry: inHours(2.5) }),
      court("v3", "Court 3", { accessTokenExpiry: inHours(37) }),
      court("v4", "Court 4"),
    ],
  });

  expect(within(card("Court 1")).getByText("Link expired")).toBeInTheDocument();
  expect(within(card("Court 2")).getByText(/^Link expires in 2h \d+m$/)).toBeInTheDocument();
  expect(within(card("Court 3")).queryByText(/^Link /)).not.toBeInTheDocument();
  expect(within(card("Court 4")).queryByText(/^Link /)).not.toBeInTheDocument();
});
