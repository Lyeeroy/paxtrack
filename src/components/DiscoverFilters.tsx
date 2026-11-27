"use client";

import { useMemo } from "react";
import {
  activeFilterCount,
  DEFAULT_DISCOVER_FILTERS,
  GENRES,
  LANGUAGES,
  normalizeFilters,
  RATINGS,
  type DiscoverFilters,
} from "@/lib/discover";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import {
  FilterCombobox,
  FilterDrawer,
  FilterSection,
  FilterToggle,
  FilterYearRange,
  type FilterOption,
} from "./FilterControls";

const TYPES: FilterOption<DiscoverFilters["type"]>[] = [
  { value: "tv", label: "TV series" },
  { value: "movie", label: "Movies" },
];

const RATING_OPTIONS: FilterOption<string>[] = RATINGS.map((rating) => ({
  value: String(rating),
  label: rating ? `${rating}+` : "Any",
}));

const LANGUAGE_OPTIONS: FilterOption<string>[] = [
  { value: "", label: "Any language" },
  ...LANGUAGES.map((language) => ({ value: language.code, label: language.label })),
];

/**
 * Discover filter sheet. A medium must be picked first because the genre ids
 * differ for TV and Movies: tapping the selected medium clears every filter
 * and returns to the five Browse columns. Every other control applies on the
 * spot; there is no Apply button. Rows and the footer are fixed so Base UI's
 * measured drawer height never moves (ADR 0013).
 */
export function DiscoverFilterSheet({
  open,
  onClose,
  filters,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  filters: DiscoverFilters;
  onChange: (f: DiscoverFilters) => void;
}) {
  const set = (patch: Partial<DiscoverFilters>) => onChange(normalizeFilters({ ...filters, ...patch }));
  const genreAnchor = useComboboxAnchor();

  const genreOptions = useMemo<FilterOption<string>[]>(
    () => GENRES[filters.type || "tv"].map((genre) => ({ value: genre.id, label: genre.label })),
    [filters.type],
  );
  const selectedGenres = genreOptions.filter((option) => filters.genre.includes(option.value));

  return (
    <FilterDrawer
      open={open}
      onClose={onClose}
      title="Discover filters"
      description={filters.type ? "Results update as you choose" : "Pick TV or Movies to filter"}
      activeCount={activeFilterCount(filters)}
      resetLabel="Reset filters"
      onReset={() => onChange(DEFAULT_DISCOVER_FILTERS)}
    >
      <FilterSection title="Type">
        <FilterToggle
          label="Type"
          value={filters.type}
          options={TYPES}
          clearValue=""
          onChange={(type) => (type ? set({ type }) : onChange(DEFAULT_DISCOVER_FILTERS))}
        />
      </FilterSection>

      {/* Native fieldset disabled is enough for Base UI inputs and buttons. */}
      <fieldset disabled={!filters.type} className="flex flex-col gap-5">
        <FilterSection title="Genre">
          {/* shadcn's documented multiple pattern: chips + anchored popup. */}
          <Combobox
            multiple
            autoHighlight
            disabled={!filters.type}
            items={genreOptions}
            value={selectedGenres}
            itemToStringValue={(option: FilterOption<string>) => option.label}
            onValueChange={(next) =>
              set({ genre: (next as FilterOption<string>[]).map((option) => option.value) })
            }
          >
            <ComboboxChips
              ref={genreAnchor}
              className="min-h-11 w-full rounded-xl border-0 bg-raised px-1.5 py-1 focus-within:ring-1 focus-within:ring-accent/60 has-[:disabled]:opacity-50 dark:has-disabled:bg-input/80"
            >
              <ComboboxValue>
                {(values: FilterOption<string>[]) => (
                  <>
                    {values.map((value) => (
                      <ComboboxChip
                        key={value.value}
                        className="h-7 shrink-0 bg-fg/10 px-2 text-[13px] text-fg"
                      >
                        {value.label}
                      </ComboboxChip>
                    ))}
                    <ComboboxChipsInput
                      aria-label="Genres"
                      placeholder="Add genre"
                      disabled={!filters.type}
                      className="min-w-16 flex-1 bg-transparent text-[16px] text-fg outline-none placeholder:text-dim"
                    />
                  </>
                )}
              </ComboboxValue>
            </ComboboxChips>
            <ComboboxContent anchor={genreAnchor} className="rounded-xl border-line bg-raised text-fg shadow-xl">
              <ComboboxEmpty className="px-3 py-2 text-[13px] text-dim">No genres found.</ComboboxEmpty>
              <ComboboxList className="max-h-[min(50dvh,20rem)]">
                {(option: FilterOption<string>) => (
                  <ComboboxItem
                    key={option.value}
                    value={option}
                    className="py-2.5 pr-8 pl-3 text-[15px] data-highlighted:bg-surface data-highlighted:text-fg focus:bg-surface focus:text-fg"
                  >
                    {option.label}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </FilterSection>

        <FilterSection title="Language">
          <FilterCombobox
            label="Original language"
            value={filters.language}
            options={LANGUAGE_OPTIONS}
            onChange={(language) => set({ language })}
          />
        </FilterSection>

        <FilterSection title="Minimum rating">
          <FilterToggle
            label="Minimum rating"
            value={String(filters.minRating)}
            options={RATING_OPTIONS}
            clearValue="0"
            onChange={(minRating) => set({ minRating: Number(minRating) })}
          />
        </FilterSection>

        <FilterSection title="Release years">
          <FilterYearRange
            from={filters.yearFrom}
            to={filters.yearTo}
            disabled={!filters.type}
            onChange={(years) => set({ yearFrom: years.from, yearTo: years.to })}
          />
        </FilterSection>
      </fieldset>
    </FilterDrawer>
  );
}
