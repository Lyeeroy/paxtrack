"use client";

import type { Item, SearchResult, Status } from "@/lib/types";
import { FilterCombobox, FilterDrawer, FilterSection, FilterToggle, type FilterOption } from "./FilterControls";

/** `in`/`out` are library presence; the Status values filter by tracked status. */
export type LibraryFilter = "all" | "in" | "out" | Status;
export type TypeFilter = "all" | "anime" | "tv" | "movie";
export interface SearchFilterState {
  type: TypeFilter;
  library: LibraryFilter;
}

export const DEFAULT_FILTERS: SearchFilterState = { type: "all", library: "all" };

export function activeFilterCount(f: SearchFilterState) {
  return (f.type !== "all" ? 1 : 0) + (f.library !== "all" ? 1 : 0);
}

export function filtersActive(f: SearchFilterState) {
  return activeFilterCount(f) > 0;
}

/** Applied to the already-loaded results, so a chip tap filters with no refetch. */
export function matchesFilters(result: SearchResult, have: Item | undefined, f: SearchFilterState) {
  if (f.type !== "all" && (result.anime ? "anime" : result.type) !== f.type) return false;
  const tracked = !!have && !have.deleted;
  if (f.library === "in") return tracked;
  if (f.library === "out") return !tracked;
  if (f.library !== "all") return tracked && have?.status === f.library;
  return true;
}

const TYPES: FilterOption<TypeFilter>[] = [
  { value: "all", label: "All" },
  { value: "anime", label: "Anime" },
  { value: "tv", label: "TV" },
  { value: "movie", label: "Movie" },
];

const LIBRARIES: FilterOption<LibraryFilter>[] = [
  { value: "all", label: "Any" },
  { value: "in", label: "In library" },
  { value: "watching", label: "Watching" },
  { value: "planned", label: "Planned" },
  { value: "completed", label: "Done" },
  { value: "dropped", label: "Dropped" },
  { value: "out", label: "Not in library" },
];

/** Filter drawer for Search results. Every control applies immediately; there is no Apply button. */
export function SearchFilterSheet({
  open,
  onClose,
  filters,
  onChange,
  subtitle,
}: {
  open: boolean;
  onClose: () => void;
  filters: SearchFilterState;
  onChange: (f: SearchFilterState) => void;
  subtitle?: string;
}) {
  return (
    <FilterDrawer
      open={open}
      onClose={onClose}
      title="Filters"
      description={subtitle ?? "Narrow the loaded results"}
      activeCount={activeFilterCount(filters)}
      resetLabel="Clear filters"
      onReset={() => onChange(DEFAULT_FILTERS)}
    >
      <FilterSection title="Type">
        <FilterToggle
          label="Type"
          value={filters.type}
          options={TYPES}
          clearValue="all"
          onChange={(type) => onChange({ ...filters, type })}
        />
      </FilterSection>
      <FilterSection title="Library">
        <FilterCombobox
          label="Library"
          value={filters.library}
          options={LIBRARIES}
          onChange={(library) => onChange({ ...filters, library: library as LibraryFilter })}
        />
      </FilterSection>
    </FilterDrawer>
  );
}
