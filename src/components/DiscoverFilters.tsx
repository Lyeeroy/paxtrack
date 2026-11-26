"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  DEFAULT_DISCOVER_FILTERS,
  filtersActive,
  GENRES,
  LANGUAGES,
  normalizeFilters,
  RATINGS,
  type DiscoverFilters,
} from "@/lib/discover";
import { IconBack, Sheet } from "./ui";

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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <p className="mt-5 text-[11px] font-medium uppercase tracking-wider text-faint first:mt-0">{title}</p>
      <div className="mt-2">{children}</div>
    </>
  );
}

/** Keeps a draft while typing: a partially typed "2" is not yet a valid year. */
function YearRange({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (years: { from: string; to: string }) => void;
}) {
  const [draft, setDraft] = useState({ from, to });
  useEffect(() => {
    if (draft.from === from && draft.to === to) return;
    const t = setTimeout(() => onChange(draft), 400);
    return () => clearTimeout(t);
  }, [draft, from, to, onChange]);

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        inputMode="numeric"
        min={1900}
        placeholder="From"
        aria-label="Release year from"
        value={draft.from}
        onChange={(e) => setDraft((y) => ({ ...y, from: e.target.value }))}
        className="h-11 min-w-0 flex-1 rounded-xl bg-raised px-3 text-[15px] text-fg outline-none placeholder:text-faint focus-visible:ring-1 focus-visible:ring-accent/60"
      />
      <span className="text-xs text-faint">to</span>
      <input
        type="number"
        inputMode="numeric"
        min={1900}
        placeholder="To"
        aria-label="Release year to"
        value={draft.to}
        onChange={(e) => setDraft((y) => ({ ...y, to: e.target.value }))}
        className="h-11 min-w-0 flex-1 rounded-xl bg-raised px-3 text-[15px] text-fg outline-none placeholder:text-faint focus-visible:ring-1 focus-visible:ring-accent/60"
      />
    </div>
  );
}

/** Discover filter sheet. Every control applies on the spot; there is no Apply button. */
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

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Discover filters"
      subtitle="Results update as you choose"
      footer={
        filtersActive(filters) ? (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_DISCOVER_FILTERS)}
            className="h-11 w-full rounded-xl text-[14px] text-dim active:bg-raised hover:text-fg"
          >
            Reset filters
          </button>
        ) : undefined
      }
    >
      <div className="px-4 pb-4 pt-1">
        <Section title="Type">
          <div className="flex flex-wrap gap-1.5">
            {(["tv", "movie"] as const).map((t) => (
              <Chip key={t} label={t === "tv" ? "TV series" : "Movies"} active={filters.type === t} onClick={() => set({ type: t })} />
            ))}
          </div>
        </Section>

        <Section title="Genre">
          <div className="flex flex-wrap gap-1.5">
            <Chip label="Any" active={!filters.genre} onClick={() => set({ genre: "" })} />
            {GENRES[filters.type].map((g) => (
              <Chip key={g.id} label={g.label} active={filters.genre === g.id} onClick={() => set({ genre: g.id })} />
            ))}
          </div>
        </Section>

        <Section title="Language">
          <div className="relative">
            <select
              value={filters.language}
              onChange={(e) => set({ language: e.target.value })}
              aria-label="Original language"
              className="h-11 w-full appearance-none rounded-xl bg-raised px-3 pr-9 text-[15px] text-fg outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
            >
              <option value="">Any language</option>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
            <IconBack className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-180 text-dim" />
          </div>
        </Section>

        <Section title="Minimum rating">
          <div className="flex flex-wrap gap-1.5">
            {RATINGS.map((r) => (
              <Chip key={r} label={r ? `${r}+` : "Any"} active={filters.minRating === r} onClick={() => set({ minRating: r })} />
            ))}
          </div>
        </Section>

        <Section title="Release years">
          <YearRange
            key={`${filters.yearFrom}:${filters.yearTo}`}
            from={filters.yearFrom}
            to={filters.yearTo}
            onChange={(years) => set({ yearFrom: years.from, yearTo: years.to })}
          />
        </Section>
      </div>
    </Sheet>
  );
}
