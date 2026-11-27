export type Status = "watching" | "planned" | "completed" | "dropped";
export type MediaType = "tv" | "movie";

export interface Item {
  id: string; // `${type}-${tmdbId}`
  tmdbId: number;
  type: MediaType;
  title: string;
  poster: string | null;
  anime: boolean;
  status: Status;
  /** "1x5" -> watched timestamp (ms). Movies use the key "m". */
  watched: Record<string, number>;
  releaseDate?: string | null;
  tvStatus?: string;
  addedAt: number;
  updatedAt: number;
  refreshedAt?: number;
  deleted?: boolean;
  /** Opened from search only; not persisted until the user makes a real change. */
  preview?: boolean;
}

export interface EpData {
  id: string;
  seasons: { n: number; eps: { e: number; name: string; air: string | null }[] }[];
}

export interface SearchResult {
  tmdbId: number;
  type: MediaType;
  title: string;
  year: string;
  poster: string | null;
  anime: boolean;
}

export interface CastMember {
  name: string;
  character: string | null;
  profile: string | null;
}

/** Provider names for one region, used by the info drawer's "Where to watch" page. */
export interface WatchInfo {
  country: string;
  link: string | null;
  flatrate: string[];
  free: string[];
  rent: string[];
  buy: string[];
}

export interface TitlePayload {
  type: MediaType;
  tmdbId: number;
  title: string;
  poster: string | null;
  anime: boolean;
  status?: string;
  releaseDate?: string | null;
  /** Descriptive metadata for the info sheet; cached in memory, not persisted. */
  overview?: string | null;
  genres?: string[];
  voteAverage?: number | null;
  runtime?: number | null;
  imdbId?: string | null;
  cast?: CastMember[];
  watch?: WatchInfo | null;
  seasons: EpData["seasons"];
}

/** Shape written by Settings → Export backup. Old backups only had `items`. */
export interface Backup {
  version: 1;
  exportedAt: string;
  items: Item[];
  eps: EpData[];
}
