import { useSyncExternalStore } from "react";
import {
  DEFAULT_DISCOVER_FILTERS,
  discoverCacheKey,
  filtersActive,
  GENRES,
  LANGUAGES,
  normalizeFilters,
  type DiscoverFilters,
} from "./discover";

const KEY = "tracker:discover-filter-history";
/** Starred entries are never trimmed; only recent unstarred ones are capped. */
const MAX_UNSTARRED = 8;
const EMPTY: DiscoverHistoryEntry[] = [];

export interface DiscoverHistoryEntry {
  /** Stable key of the filter set, so a repeat use moves the same entry up. */
  id: string;
  filters: DiscoverFilters;
  starred: boolean;
  usedAt: number;
}

let entries: DiscoverHistoryEntry[] | null = null;
const listeners = new Set<() => void>();

function load(): DiscoverHistoryEntry[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const seen = new Set<string>();
    const out: DiscoverHistoryEntry[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const saved = item as Partial<DiscoverHistoryEntry> & { filters?: Partial<DiscoverFilters> };
      const f = normalizeFilters({
        ...DEFAULT_DISCOVER_FILTERS,
        type: saved.filters?.type ?? "",
        genre: Array.isArray(saved.filters?.genre) ? saved.filters.genre : [],
        language: typeof saved.filters?.language === "string" ? saved.filters.language : "",
        minRating: Number(saved.filters?.minRating) || 0,
        yearFrom: typeof saved.filters?.yearFrom === "string" ? saved.filters.yearFrom : "",
        yearTo: typeof saved.filters?.yearTo === "string" ? saved.filters.yearTo : "",
      });
      if (!filtersActive(f)) continue;
      const id = discoverCacheKey(f);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        filters: f,
        starred: saved.starred === true,
        usedAt: Number(saved.usedAt) || 0,
      });
    }
    return out.sort((a, b) => b.usedAt - a.usedAt);
  } catch {
    // Corrupt JSON or storage disabled: an empty history is harmless.
    return EMPTY;
  }
}

function snapshot(): DiscoverHistoryEntry[] {
  if (entries === null) entries = load();
  return entries;
}

function commit(next: DiscoverHistoryEntry[]) {
  entries = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode / quota: the in-memory history still works this session.
  }
  listeners.forEach((l) => l());
}

/** Same external-store shape as the other localStorage-backed modules. */
export function useDiscoverFilterHistory(): DiscoverHistoryEntry[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    snapshot,
    () => EMPTY,
  );
}

/** Called when the filter drawer closes: remember the set the user just used. */
export function recordDiscoverFilters(filters: DiscoverFilters) {
  if (!filtersActive(filters)) return;
  const f = normalizeFilters(filters);
  const id = discoverCacheKey(f);
  const now = Date.now();
  const current = snapshot();
  const starred = current.filter((e) => e.starred);
  const recent = current.filter((e) => !e.starred && e.id !== id).slice(0, MAX_UNSTARRED - 1);
  const kept = starred.filter((e) => e.id !== id);
  commit(
    [{ id, filters: f, starred: current.find((e) => e.id === id)?.starred ?? false, usedAt: now }, ...kept, ...recent].sort(
      (a, b) => b.usedAt - a.usedAt,
    ),
  );
}

export function toggleDiscoverHistoryStar(id: string) {
  commit(snapshot().map((e) => (e.id === id ? { ...e, starred: !e.starred } : e)));
}

export function clearDiscoverHistory() {
  commit([]);
}

/** One-line summary for a history row, e.g. "Movies · Action · English · 7+ · 2020–2024". */
export function describeDiscoverFilters(f: DiscoverFilters) {
  const parts: string[] = [];
  if (f.type) parts.push(f.type === "tv" ? "TV series" : "Movies");
  if (f.genre.length) {
    const names = f.genre
      .map((id) => GENRES[f.type || "tv"].find((g) => g.id === id)?.label)
      .filter((name): name is string => !!name);
    parts.push(names.length ? names.join(" + ") : `${f.genre.length} genres`);
  }
  if (f.language) parts.push(LANGUAGES.find((l) => l.code === f.language)?.label ?? f.language);
  if (f.minRating) parts.push(`${f.minRating}+`);
  if (f.yearFrom && f.yearTo) parts.push(`${f.yearFrom}–${f.yearTo}`);
  else if (f.yearFrom) parts.push(`From ${f.yearFrom}`);
  else if (f.yearTo) parts.push(`Before ${f.yearTo}`);
  return parts.join(" · ") || "All titles";
}
