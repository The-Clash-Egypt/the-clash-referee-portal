import React from "react";
import { Chip } from "../../../../ui/Chip";
import { FilterOptions } from "../../types/match";
import { MatchFilterState } from "../../hooks/useMatchFilters";
import { formatDayLabel } from "../../utils/timeline";
import { formatOption, nameForValue } from "../../utils/filterOptions";
import "./ActiveFilterChips.scss";

interface ActiveFilterChipsProps {
  filters: MatchFilterState;
  filterOptions: FilterOptions;
  setFilter: <K extends keyof MatchFilterState>(k: K, v: MatchFilterState[K]) => void;
  /** Tapping a chip's label opens the filters sheet. */
  onOpenFilters: () => void;
}

interface ActiveChip {
  key: string;
  label: string;
  remove: () => void;
}

/** The filters in force, one chip each under the app bar (mockup `.chips`); ✕ drops that filter. */
const ActiveFilterChips: React.FC<ActiveFilterChipsProps> = ({ filters, filterOptions, setFilter, onOpenFilters }) => {
  const chips: ActiveChip[] = [];
  if (filters.date !== "all") {
    chips.push({ key: "date", label: formatDayLabel(filters.date) || filters.date, remove: () => setFilter("date", "all") });
  }
  if (filters.category !== "all") {
    chips.push({ key: "category", label: filters.category, remove: () => setFilter("category", "all") });
  }
  if (filters.format !== "all") {
    const format = filterOptions.formats.map((f) => formatOption(f)).find((f) => f.value === filters.format);
    chips.push({ key: "format", label: format?.label ?? filters.format, remove: () => setFilter("format", "all") });
  }
  if (filters.round !== "all") {
    chips.push({ key: "round", label: filters.round, remove: () => setFilter("round", "all") });
  }
  filters.venues.forEach((venue) =>
    chips.push({
      key: `venue-${venue}`,
      label: venue,
      remove: () => setFilter("venues", filters.venues.filter((v) => v !== venue)),
    })
  );
  if (filters.team !== "all") {
    chips.push({ key: "team", label: nameForValue(filterOptions.teams, filters.team), remove: () => setFilter("team", "all") });
  }
  if (filters.referee !== "all") {
    chips.push({
      key: "referee",
      label: nameForValue(filterOptions.referees, filters.referee),
      remove: () => setFilter("referee", "all"),
    });
  }

  if (chips.length === 0) return null;
  return (
    <div className="active-filters" role="group" aria-label="Active filters">
      <div className="active-filters__row">
        {chips.map((chip) => (
          <Chip key={chip.key} className="active-filters__chip" onClick={onOpenFilters} onRemove={chip.remove}>
            {chip.label}
          </Chip>
        ))}
      </div>
    </div>
  );
};

export default ActiveFilterChips;
