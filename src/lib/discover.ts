import type { MediaType } from "./types";

export interface DiscoverFilters {
  type: MediaType;
  /** TMDB genre id, valid for the selected type. */
  genre: string;
  /** ISO 639-1 original language. */
  language: string;
  /** vote_average.gte, 0–10. */
  minRating: number;
  /** Four-digit release years, inclusive. */
  yearFrom: string;
  yearTo: string;
}

export const DEFAULT_DISCOVER_FILTERS: DiscoverFilters = {
  type: "tv",
  genre: "",
  language: "",
  minRating: 0,
  yearFrom: "",
  yearTo: "",
};

/** Movie and TV genre ids differ for a few names, so keep both lists. */
export const GENRES: Record<MediaType, { id: string; label: string }[]> = {
  movie: [
    { id: "28", label: "Action" },
    { id: "12", label: "Adventure" },
    { id: "16", label: "Animation" },
    { id: "35", label: "Comedy" },
    { id: "80", label: "Crime" },
    { id: "99", label: "Documentary" },
    { id: "18", label: "Drama" },
    { id: "10751", label: "Family" },
    { id: "14", label: "Fantasy" },
    { id: "36", label: "History" },
    { id: "27", label: "Horror" },
    { id: "10402", label: "Music" },
    { id: "9648", label: "Mystery" },
    { id: "10749", label: "Romance" },
    { id: "878", label: "Science fiction" },
    { id: "53", label: "Thriller" },
    { id: "10752", label: "War" },
    { id: "37", label: "Western" },
  ],
  tv: [
    { id: "10759", label: "Action & adventure" },
    { id: "16", label: "Animation" },
    { id: "35", label: "Comedy" },
    { id: "80", label: "Crime" },
    { id: "99", label: "Documentary" },
    { id: "18", label: "Drama" },
    { id: "10751", label: "Family" },
    { id: "10762", label: "Kids" },
    { id: "9648", label: "Mystery" },
    { id: "10763", label: "News" },
    { id: "10764", label: "Reality" },
    { id: "10765", label: "Sci-fi & fantasy" },
    { id: "10766", label: "Soap" },
    { id: "10767", label: "Talk" },
    { id: "10768", label: "War & politics" },
    { id: "37", label: "Western" },
  ],
};

export const LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
  { code: "hi", label: "Hindi" },
  { code: "th", label: "Thai" },
  { code: "tr", label: "Turkish" },
  { code: "pl", label: "Polish" },
  { code: "nl", label: "Dutch" },
  { code: "sv", label: "Swedish" },
  { code: "da", label: "Danish" },
  { code: "no", label: "Norwegian" },
  { code: "fi", label: "Finnish" },
  { code: "ar", label: "Arabic" },
  { code: "he", label: "Hebrew" },
  { code: "id", label: "Indonesian" },
  { code: "vi", label: "Vietnamese" },
  { code: "cs", label: "Czech" },
  { code: "el", label: "Greek" },
];

export const RATINGS = [0, 6, 7, 8, 9];

/** Only allow values we can validate; the same normalizer runs on client and server. */
export function normalizeFilters(f: DiscoverFilters): DiscoverFilters {
  const type: MediaType = f.type === "movie" ? "movie" : "tv";
  const genre = GENRES[type].some((g) => g.id === f.genre) ? f.genre : "";
  const language = LANGUAGES.some((l) => l.code === f.language) ? f.language : "";
  const rating = Number(f.minRating);
  const minRating = Number.isFinite(rating) && rating > 0 ? Math.min(10, Math.round(rating * 10) / 10) : 0;
  const maxYear = new Date().getFullYear() + 1;
  const year = (raw: string) => (/^\d{4}$/.test(raw) && Number(raw) >= 1900 && Number(raw) <= maxYear ? raw : "");
  const from = year(f.yearFrom);
  const to = year(f.yearTo);
  // A reversed range is almost always a typo; swap instead of returning nothing.
  return { type, genre, language, minRating, yearFrom: from && to && from > to ? to : from, yearTo: from && to && from > to ? from : to };
}

export function filtersActive(f: DiscoverFilters) {
  return f.type !== DEFAULT_DISCOVER_FILTERS.type || !!f.genre || !!f.language || f.minRating > 0 || !!f.yearFrom || !!f.yearTo;
}

/** Stable cache-key suffix: changing any filter gives Discover its own page slots. */
export function discoverCacheKey(f: DiscoverFilters) {
  return `discover:${f.type}:${f.genre}:${f.language}:${f.minRating}:${f.yearFrom}:${f.yearTo}`;
}

/** Parameters sent to our own API; the route rebuilds TMDB params from these. */
export function discoverQuery(f: DiscoverFilters): Record<string, string> {
  return {
    category: "discover",
    type: f.type,
    ...(f.genre ? { genre: f.genre } : {}),
    ...(f.language ? { language: f.language } : {}),
    ...(f.minRating ? { minRating: String(f.minRating) } : {}),
    ...(f.yearFrom ? { yearFrom: f.yearFrom } : {}),
    ...(f.yearTo ? { yearTo: f.yearTo } : {}),
  };
}

/** TMDB discover parameters, shared by the client query and the server route. */
export function tmdbDiscoverParams(f: DiscoverFilters): Record<string, string> {
  const date = f.type === "tv" ? "first_air_date" : "primary_release_date";
  return {
    sort_by: "popularity.desc",
    include_adult: "false",
    ...(f.genre ? { with_genres: f.genre } : {}),
    ...(f.language ? { with_original_language: f.language } : {}),
    ...(f.minRating ? { "vote_average.gte": String(f.minRating) } : {}),
    ...(f.yearFrom ? { [`${date}.gte`]: `${f.yearFrom}-01-01` } : {}),
    ...(f.yearTo ? { [`${date}.lte`]: `${f.yearTo}-12-31` } : {}),
  };
}
