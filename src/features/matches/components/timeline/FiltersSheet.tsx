import React, { useId } from "react";
import Drawer from "../../../shared/components/Drawer";
import { Button } from "../../../../ui/Button";
import { Chip } from "../../../../ui/Chip";
import SearchableDropdown from "../SearchableDropdown";
import { FilterOptions } from "../../types/match";
import { MatchFilterState } from "../../hooks/useMatchFilters";
import { courtShort, formatDayLabel } from "../../utils/timeline";
import { formatOption } from "../../utils/filterOptions";
import "./FiltersSheet.scss";

interface FiltersSheetProps {
  isOpen: boolean;
  onClose: () => void;
  filters: MatchFilterState;
  filterOptions: FilterOptions;
  setFilter: <K extends keyof MatchFilterState>(k: K, v: MatchFilterState[K]) => void;
  onClearAll: () => void;
  activeCount: number;
  /** How many matches the open tab has with these filters (from the counts call). */
  resultCount: number;
}

const Group = ({ label, children }: { label: string; children: React.ReactNode }) => {
  const id = useId();
  return (
    <div className="filters-sheet__group" role="group" aria-labelledby={id}>
      <span id={id} className="filters-sheet__label">
        {label}
      </span>
      {children}
    </div>
  );
};

/** One-of chips with "All" first; tapping the chosen one again goes back to All. */
const OneOf = ({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; title?: string }[];
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="filters-sheet__chips">
    <Chip selected={value === "all"} onClick={() => onChange("all")}>
      All
    </Chip>
    {options.map((option) => (
      <Chip
        key={option.value}
        selected={value === option.value}
        title={option.title}
        onClick={() => onChange(value === option.value ? "all" : option.value)}
      >
        {option.label}
      </Chip>
    ))}
  </div>
);

/**
 * All the match filters in one sheet (mockup match-flow-v2.html phone 1): chips for Day, Category, Court (several),
 * Round and Format (when there is a choice), searchable pickers for Team and Referee. Every change applies at once;
 * the button shows how many matches the open tab now has.
 */
const FiltersSheet: React.FC<FiltersSheetProps> = ({
  isOpen,
  onClose,
  filters,
  filterOptions,
  setFilter,
  onClearAll,
  activeCount,
  resultCount,
}) => {
  const dates = filterOptions.dates.slice().sort();
  const venues = filterOptions.venues;
  // Short court names ("C1") unless two courts would read the same.
  const shortCourts = venues.map(courtShort);
  const courtLabel = new Set(shortCourts).size === shortCourts.length ? (i: number) => shortCourts[i] : (i: number) => venues[i];
  const formats = filterOptions.formats.map((format) => formatOption(format));

  const toggleVenue = (venue: string) =>
    setFilter(
      "venues",
      filters.venues.includes(venue) ? filters.venues.filter((v) => v !== venue) : filters.venues.concat(venue)
    );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Filters"
      className="filters-sheet"
      headerAction={
        <button type="button" className="drawer__link" onClick={onClearAll} disabled={activeCount === 0 && !filters.search}>
          Clear all
        </button>
      }
      footer={
        <Button size="lg" block onClick={onClose}>
          Show {resultCount} {resultCount === 1 ? "match" : "matches"}
        </Button>
      }
    >
      {dates.length > 1 || filters.date !== "all" ? (
        <Group label="Day">
          <OneOf
            value={filters.date}
            onChange={(value) => setFilter("date", value)}
            options={dates.map((date) => ({ value: date, label: formatDayLabel(date, { withMonth: false }) || date }))}
          />
        </Group>
      ) : null}

      {filterOptions.categories.length > 0 ? (
        <Group label="Category">
          <OneOf
            value={filters.category}
            onChange={(value) => setFilter("category", value)}
            options={filterOptions.categories.map((category) => ({ value: category, label: category }))}
          />
        </Group>
      ) : null}

      {venues.length > 0 ? (
        <Group label="Court">
          <div className="filters-sheet__chips">
            {venues.map((venue, index) => (
              <Chip
                key={venue}
                selected={filters.venues.includes(venue)}
                title={venue}
                onClick={() => toggleVenue(venue)}
              >
                {courtLabel(index)}
              </Chip>
            ))}
          </div>
        </Group>
      ) : null}

      {filterOptions.rounds.length > 0 ? (
        <Group label="Round">
          <OneOf
            value={filters.round}
            onChange={(value) => setFilter("round", value)}
            options={filterOptions.rounds.map((round) => ({ value: round, label: round }))}
          />
        </Group>
      ) : null}

      {formats.length > 1 ? (
        <Group label="Format">
          <OneOf value={filters.format} onChange={(value) => setFilter("format", value)} options={formats} />
        </Group>
      ) : null}

      <Group label="Referee">
        <SearchableDropdown
          options={filterOptions.referees || []}
          value={filters.referee}
          onChange={(value) => setFilter("referee", value)}
          placeholder="All Referees"
          showAllOption={true}
          allOptionText="All Referees"
        />
      </Group>

      <Group label="Team">
        <SearchableDropdown
          options={filterOptions.teams || []}
          value={filters.team}
          onChange={(value) => setFilter("team", value)}
          placeholder="All Teams"
          showAllOption={true}
          allOptionText="All Teams"
        />
      </Group>
    </Drawer>
  );
};

export default FiltersSheet;
