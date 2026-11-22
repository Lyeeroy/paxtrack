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

export interface TitlePayload {
  type: MediaType;
  tmdbId: number;
  title: string;
  poster: string | null;
  anime: boolean;
  status?: string;
  releaseDate?: string | null;
  seasons: EpData["seasons"];
}
