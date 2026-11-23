import type { EpData, Item, MediaType, Status } from "./types";

export interface ParsedBackup {
  items: Item[];
  eps: EpData[];
}

const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseItem(v: unknown): Item | null {
  if (!isRecord(v)) return null;
  const { id, tmdbId, type, title, poster, anime, status, watched, releaseDate, tvStatus, addedAt, updatedAt, refreshedAt } = v;
  if (typeof id !== "string" || !id) return null;
  if (typeof tmdbId !== "number" || !Number.isFinite(tmdbId)) return null;
  if (type !== "tv" && type !== "movie") return null;
  if (typeof title !== "string" || !isRecord(watched)) return null;
  if (typeof addedAt !== "number" || typeof updatedAt !== "number") return null;
  if (Object.values(watched).some((t) => typeof t !== "number")) return null;

  const item: Item = {
    id,
    tmdbId,
    type: type as MediaType,
    title,
    poster: typeof poster === "string" ? poster : null,
    anime: anime === true,
    status: status === "watching" || status === "planned" || status === "completed" || status === "dropped" ? (status as Status) : "planned",
    watched: { ...watched } as Record<string, number>,
    addedAt,
    updatedAt,
  };
  if (typeof releaseDate === "string" || releaseDate === null) item.releaseDate = releaseDate;
  if (typeof tvStatus === "string") item.tvStatus = tvStatus;
  if (typeof refreshedAt === "number") item.refreshedAt = refreshedAt;
  if (v.deleted === true) item.deleted = true;
  if (v.preview === true) item.preview = true;
  return item;
}

function parseEp(v: unknown): EpData | null {
  if (!isRecord(v) || typeof v.id !== "string" || !v.id || !Array.isArray(v.seasons)) return null;
  const seasons: EpData["seasons"] = [];
  for (const s of v.seasons) {
    if (!isRecord(s) || typeof s.n !== "number" || !Array.isArray(s.eps)) continue;
    const eps: EpData["seasons"][number]["eps"] = [];
    for (const e of s.eps) {
      if (!isRecord(e) || typeof e.e !== "number" || typeof e.name !== "string") continue;
      eps.push({ e: e.e, name: e.name, air: typeof e.air === "string" ? e.air : null });
    }
    seasons.push({ n: s.n, eps });
  }
  return { id: v.id, seasons };
}

/** Parse a backup file, accepting both the current version and older `{ items }` files. */
export function parseBackup(text: string): ParsedBackup {
  if (text.length > MAX_BACKUP_BYTES) throw new Error("That backup file is too large.");

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (!isRecord(raw) || !Array.isArray(raw.items)) throw new Error("That file isn't a Tracker backup.");

  const items = new Map<string, Item>();
  for (const entry of raw.items) {
    const item = parseItem(entry);
    // Duplicates are resolved the same way sync resolves conflicts: newest wins.
    if (item && (!items.has(item.id) || item.updatedAt > items.get(item.id)!.updatedAt)) items.set(item.id, item);
  }
  if (raw.items.length && !items.size) throw new Error("No valid titles found in that backup.");

  const eps = new Map<string, EpData>();
  if (Array.isArray(raw.eps)) {
    for (const entry of raw.eps) {
      const ep = parseEp(entry);
      if (ep) eps.set(ep.id, ep);
    }
  }

  return { items: [...items.values()], eps: [...eps.values()] };
}
