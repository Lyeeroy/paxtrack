"use client";

import type { Item, SearchResult, Status } from "@/lib/types";
import { IconClose } from "./ui";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "./ui/drawer";

/** `in`/`out` are library presence; the Status values filter by tracked status. */
export type LibraryFilter = "all" | "in" | "out" | Status;
export type TypeFilter = "all" | "anime" | "tv" | "movie";
export interface SearchFilterState {
  type: TypeFilter;
  library: LibraryFilter;
}

export const DEFAULT_FILTERS: SearchFilterState = { type: "all", library: "all" };

export function filtersActive(f: SearchFilterState) {
  return f.type !== "all" || f.library !== "all";
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

const TYPES: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "anime", label: "Anime" },
  { id: "tv", label: "TV" },
  { id: "movie", label: "Movie" },
];

const LIBRARIES: { id: LibraryFilter; label: string }[] = [
  { id: "all", label: "Any" },
  { id: "in", label: "In library" },
  { id: "watching", label: "Watching" },
  { id: "planned", label: "Planned" },
  { id: "completed", label: "Done" },
  { id: "dropped", label: "Dropped" },
  { id: "out", label: "Not in library" },
];

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-9 rounded-full px-3.5 text-[13px] active:scale-95 ${
        active ? "bg-fg font-medium text-black" : "bg-surface text-dim active:bg-raised"
      }`}
    >
      {label}
    </button>
  );
}

/** Filter drawer for Search results. Every chip applies immediately; there is no Apply button. */
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
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      showSwipeHandle
    >
      <DrawerContent className="mx-auto max-w-xl rounded-t-2xl border-line bg-surface pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <DrawerHeader className="relative pb-0 text-left group-data-[swipe-axis=y]/drawer-popup:text-left">
          <div className="min-w-0 flex-1">
            <DrawerTitle className="truncate text-[16px] font-semibold leading-tight text-fg">
              Filters
            </DrawerTitle>
            {subtitle ? (
              <DrawerDescription className="mt-0.5 truncate text-xs text-dim">
                {subtitle}
              </DrawerDescription>
            ) : null}
          </div>
          <DrawerClose
            aria-label="Close"
            className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-full text-dim active:bg-raised hover:text-fg"
          >
            <IconClose className="size-5" />
          </DrawerClose>
        </DrawerHeader>
        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain">
          <div className="px-4 pb-4 pt-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-faint">Type</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TYPES.map((t) => (
                <Chip
                  key={t.id}
                  label={t.label}
                  active={filters.type === t.id}
                  onClick={() => onChange({ ...filters, type: t.id })}
                />
              ))}
            </div>
            <p className="mt-5 text-[11px] font-medium uppercase tracking-wider text-faint">Library</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {LIBRARIES.map((l) => (
                <Chip
                  key={l.id}
                  label={l.label}
                  active={filters.library === l.id}
                  onClick={() => onChange({ ...filters, library: l.id })}
                />
              ))}
            </div>
          </div>
        </div>
        {filtersActive(filters) ? (
          <DrawerFooter className="border-t border-line/70 p-4">
            <button
              type="button"
              onClick={() => onChange(DEFAULT_FILTERS)}
              className="h-11 w-full rounded-xl text-[14px] text-dim active:bg-raised hover:text-fg"
            >
              Clear filters
            </button>
          </DrawerFooter>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
