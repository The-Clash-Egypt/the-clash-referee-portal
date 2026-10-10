import { FilterOptions } from "../types/match";

export const EMPTY_FILTER_OPTIONS: FilterOptions = {
  tournaments: [],
  categories: [],
  formats: [],
  rounds: [],
  venues: [],
  teams: [],
  referees: [],
  dates: [],
};

// Knockout rounds in tournament order; any other round (Round 1, Group A, ...) comes first, in natural order.
const KNOCKOUT_ORDER: Record<string, number> = {
  r16: 1,
  "round of 16": 1,
  quarter: 2,
  "quarter final": 2,
  quarterfinals: 2,
  "quarter-final": 2,
  "quarter-finals": 2,
  semi: 3,
  "semi final": 3,
  semifinals: 3,
  "semi-final": 3,
  "semi-finals": 3,
  final: 4,
  finals: 4,
  "third place": 5,
  "3rd place": 5,
};

/** Courts in natural order (Court 1, Court 2, ..., Court 10). */
export const sortVenues = (venues: string[]): string[] =>
  venues.slice().sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

/** Regular rounds first (Round 1, Round 2, ...), then the knockout rounds in tournament order. */
export const sortRounds = (rounds: string[]): string[] =>
  rounds.slice().sort((a, b) => {
    const aKnockout = KNOCKOUT_ORDER[a.toLowerCase().trim()];
    const bKnockout = KNOCKOUT_ORDER[b.toLowerCase().trim()];
    if (aKnockout && bKnockout) return aKnockout - bKnockout;
    if (aKnockout) return 1;
    if (bKnockout) return -1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

/** The API's filter options with every list present, courts and rounds in display order. */
export const normalizeFilterOptions = (options?: Partial<FilterOptions> | null): FilterOptions => ({
  ...EMPTY_FILTER_OPTIONS,
  ...(options ?? {}),
  tournaments: options?.tournaments ?? [],
  categories: options?.categories ?? [],
  formats: options?.formats ?? [],
  rounds: sortRounds(options?.rounds ?? []),
  venues: sortVenues(options?.venues ?? []),
  teams: options?.teams ?? [],
  referees: options?.referees ?? [],
  dates: options?.dates ?? [],
});

type NamedOption = string | { id?: string; name?: string; fullName?: string; alias?: string; type?: string };

/** A format option's value and label: the API may send strings or objects (alias, else name/type/id). */
export const formatOption = (format: NamedOption): { value: string; label: string } => {
  if (typeof format === "string") return { value: format, label: format };
  const value = format.alias ?? format.name ?? format.type ?? format.id ?? "";
  const alias = format.alias;
  const fallback = format.name ?? format.type ?? format.id ?? "";
  const label = alias && String(alias).trim() !== "" ? alias : fallback;
  return { value: value || label, label };
};

/** The display name of a team or referee option (string or object). */
export const optionName = (option: NamedOption): string =>
  typeof option === "string" ? option : option.name || option.fullName || "Unknown";

/** The value a team or referee option filters by (string, else its id). */
export const optionValue = (option: NamedOption): string =>
  typeof option === "string" ? option : option.id || optionName(option);

/** The name shown for a team/referee filter value, falling back to the value itself. */
export const nameForValue = (options: NamedOption[] | undefined, value: string): string => {
  const found = options?.find((option) => optionValue(option) === value);
  return found ? optionName(found) : value;
};
