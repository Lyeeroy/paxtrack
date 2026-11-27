"use client";

import { useMemo, useState } from "react";
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
  clearDiscoverHistory,
  describeDiscoverFilters,
  recordDiscoverFilters,
  toggleDiscoverHistoryStar,
  useDiscoverFilterHistory,
} from "@/lib/filter-history";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, Star, XIcon } from "lucide-react";
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
 * spot; there is no Apply button. The footer's History button switches to a
 * localStorage-backed list of past filter sets; starring pins an entry. The
 * controls stay in the layout while the list overlays them so Base UI's
 * measured drawer height never moves (ADR 0013). The history view has only a
 * Back button in the footer and a Badge-styled "Clear history" control above
 * the list.
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
  const [view, setView] = useState<"filters" | "history">("filters");
  const history = useDiscoverFilterHistory();
  const set = (patch: Partial<DiscoverFilters>) => onChange(normalizeFilters({ ...filters, ...patch }));
  const genreAnchor = useComboboxAnchor();
  const historyView = view === "history";

  const close = () => {
    // Auto-remember the set the user just used; starring happens in the list.
    recordDiscoverFilters(filters);
    setView("filters");
    onClose();
  };
  const applyHistory = (f: DiscoverFilters) => {
    onChange(f);
    recordDiscoverFilters(f);
    setView("filters");
    onClose();
  };

  const genreOptions = useMemo<FilterOption<string>[]>(
    () => GENRES[filters.type || "tv"].map((genre) => ({ value: genre.id, label: genre.label })),
    [filters.type],
  );
  const selectedGenres = genreOptions.filter((option) => filters.genre.includes(option.value));

  return (
    <FilterDrawer
      open={open}
      onClose={close}
      title={historyView ? "Filter history" : "Discover filters"}
      description={historyView ? "Tap an entry to apply it" : filters.type ? "Results update as you choose" : "Pick TV or Movies to filter"}
      activeCount={activeFilterCount(filters)}
      resetLabel={historyView ? "Back" : "Reset filters"}
      onReset={historyView ? () => setView("filters") : () => onChange(DEFAULT_DISCOVER_FILTERS)}
      resetDisabled={historyView ? false : undefined}
      footerAction={
        historyView ? null : (
          <Button
            variant="secondary"
            onClick={() => setView("history")}
            className="h-11 flex-1 gap-1.5 rounded-xl text-[14px]"
          >
            <History className="size-4" />
            History
          </Button>
        )
      }
    >
      <div className="relative">
        <div className={`flex flex-col gap-5 ${historyView ? "invisible" : ""}`} aria-hidden={historyView} inert={historyView}>
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
      </div>

      {historyView ? (
        <div className="absolute inset-0 flex flex-col rounded-xl bg-surface">
          {history.length ? (
              <>
              <div className="flex items-center justify-between gap-2 px-1 pb-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-faint">Recent filters</p>
                <Badge
                  variant="outline"
                  render={
                    <button
                      type="button"
                      onClick={clearDiscoverHistory}
                      className="h-7 cursor-pointer gap-1 rounded-full border-line px-2.5 text-[11px] text-dim active:bg-raised hover:text-fg"
                    />
                  }
                >
                  <XIcon className="size-3" />
                  Clear history
                </Badge>
              </div>
              <ul className="min-h-0 flex-1 divide-y divide-line/70 overflow-y-auto overscroll-contain">
                {history.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-1 border-b border-line/60 last:border-0">
                    <button
                      type="button"
                      onClick={() => applyHistory(entry.filters)}
                      className="flex min-h-[52px] min-w-0 flex-1 flex-col items-start py-2 text-left active:opacity-80"
                    >
                      <span className="w-full break-words text-[14px] leading-snug text-fg">{describeDiscoverFilters(entry.filters)}</span>
                      <span className="mt-0.5 text-[11px] text-faint">{entry.starred ? "Starred" : "Recent"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleDiscoverHistoryStar(entry.id)}
                      aria-label={entry.starred ? "Unstar filter" : "Star filter"}
                      aria-pressed={entry.starred}
                      className="flex size-11 shrink-0 items-center justify-center rounded-full text-dim active:bg-raised hover:text-fg"
                    >
                      <Star className={cn("size-5", entry.starred && "fill-accent text-accent")} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1.5 px-8 text-center">
              <History className="size-5 text-faint" />
              <p className="text-[14px] text-dim">No filter history yet</p>
              <p className="text-xs text-faint">Filters you use are saved here. Star one to keep it.</p>
            </div>
          )}
        </div>
      ) : null}
      </div>
    </FilterDrawer>
  );
}
