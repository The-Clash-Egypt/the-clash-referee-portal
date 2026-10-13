import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import FiltersSheet from "./FiltersSheet";
import { MatchFilterState } from "../../hooks/useMatchFilters";
import { FilterOptions } from "../../types/match";
import { normalizeFilterOptions } from "../../utils/filterOptions";

const noFilters: MatchFilterState = {
  tab: "all",
  search: "",
  date: "all",
  category: "all",
  format: "all",
  round: "all",
  venues: [],
  team: "all",
  referee: "all",
};

const open = (filters: Partial<MatchFilterState>, options: Partial<FilterOptions>) =>
  render(
    <FiltersSheet
      isOpen
      onClose={jest.fn()}
      filters={{ ...noFilters, ...filters }}
      filterOptions={normalizeFilterOptions(options)}
      setFilter={jest.fn()}
      onClearAll={jest.fn()}
      activeCount={0}
      resultCount={3}
    />
  );

const options = {
  categories: ["Mixed Americano", "Men's Open"],
  teams: ["Ali H.", "Sand Sharks"],
  playerCategories: ["Mixed Americano"],
};

test.each([
  ["a category of single players", "Mixed Americano", "Player", "All players"],
  ["another category", "Men's Open", "Team", "All Teams"],
  ["no category while some are not of single players", "all", "Team", "All Teams"],
])("%s (%s): the filter is called %s", (_when, category, label, allLabel) => {
  open({ category }, options);

  const group = screen.getByRole("group", { name: label });
  expect(within(group).getByRole("textbox")).toHaveValue(allLabel);
  expect(screen.queryByRole("group", { name: label === "Player" ? "Team" : "Player" })).not.toBeInTheDocument();
});

test("with every category of single players, and no category filtered, it is the Player filter", () => {
  open({}, { ...options, categories: ["Mixed Americano"] });

  expect(screen.getByRole("group", { name: "Player" })).toBeInTheDocument();
});

test("a server that sends no player categories keeps the Team filter", () => {
  open({ category: "Mixed Americano" }, { categories: ["Mixed Americano"], teams: ["Ali H."] });

  expect(screen.getByRole("group", { name: "Team" })).toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Player" })).not.toBeInTheDocument();
});
