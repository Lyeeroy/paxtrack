import { DEFAULT_DISCOVER_FILTERS, normalizeFilters, tmdbDiscoverParams } from "@/lib/discover";
import type { MediaType, SearchResult } from "@/lib/types";
import { isAnime, tmdb } from "@/lib/tmdb-server";

export const dynamic = "force-dynamic";

/** Default Browse columns stay shallow; Discover follows TMDB's own page count. */
const MAX_PAGE = 500;

type Category = "discover" | "trending" | "popular" | "top-rated" | "in-cinema";

type Shelf = { path: string; params: Record<string, string>; type?: MediaType };

/** Endpoints without media_type get an explicit type. Discover is filtered per request. */
const SHELVES: Record<Exclude<Category, "discover">, Shelf> = {
  trending: { path: "/trending/all/week", params: {} },
  popular: { path: "/movie/popular", params: {}, type: "movie" },
  "top-rated": { path: "/movie/top_rated", params: {}, type: "movie" },
  "in-cinema": { path: "/movie/now_playing", params: {}, type: "movie" },
};

function discoverShelf(url: URL): Shelf {
  const raw = (key: string) => url.searchParams.get(key) ?? "";
  // Rebuild from whitelisted values: no raw client param ever reaches TMDB.
  const f = normalizeFilters({
    ...DEFAULT_DISCOVER_FILTERS,
    type: raw("type") === "movie" ? "movie" : "tv",
    genre: raw("genre"),
    language: raw("language"),
    minRating: Number(raw("minRating") || 0),
    yearFrom: raw("yearFrom"),
    yearTo: raw("yearTo"),
  });
  return { path: `/discover/${f.type}`, params: tmdbDiscoverParams(f), type: f.type };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const category = (url.searchParams.get("category") ?? "") as Category;
  const shelf: Shelf | undefined =
    category === "discover"
      ? discoverShelf(url)
      : Object.hasOwn(SHELVES, category)
        ? SHELVES[category as Exclude<Category, "discover">]
        : undefined;
  if (!shelf) return Response.json({ error: "Unknown category" }, { status: 400 });
  const raw = Number(url.searchParams.get("page") ?? "1");
  const requested = Number.isFinite(raw) ? Math.max(Math.floor(raw), 1) : 1;
  const page = category === "discover" ? requested : Math.min(requested, MAX_PAGE);
  try {
    const data = await tmdb(shelf.path, { ...(shelf.params ?? {}), page: String(page) }, 3600);
    const results = (data.results as any[])
      .map((r): SearchResult | null => {
        const type = (r.media_type ?? shelf.type) as MediaType | undefined;
        if (type !== "tv" && type !== "movie") return null;
        return {
          tmdbId: r.id as number,
          type,
          title: (r.title ?? r.name ?? "") as string,
          year: String(r.release_date ?? r.first_air_date ?? "").slice(0, 4),
          poster: (r.poster_path ?? null) as string | null,
          anime: isAnime(r.genre_ids, r.original_language, r.origin_country),
        };
      })
      .filter((r): r is SearchResult => r !== null)
      .slice(0, 20);
    return Response.json({
      results,
      page: (data.page as number) || page,
      totalPages:
        category === "discover"
          ? (data.total_pages as number) || 1
          : Math.min((data.total_pages as number) || 1, MAX_PAGE),
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
