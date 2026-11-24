import type { MediaType, SearchResult } from "@/lib/types";
import { isAnime, tmdb } from "@/lib/tmdb-server";

export const dynamic = "force-dynamic";

type Category = "discover" | "trending" | "popular" | "top-rated" | "in-cinema";

/** One TMDB endpoint per column. Endpoints without media_type get an explicit type. */
const SHELVES: Record<Category, { path: string; params?: Record<string, string>; type?: MediaType }> = {
  discover: { path: "/discover/tv", params: { sort_by: "popularity.desc" }, type: "tv" },
  trending: { path: "/trending/all/week" },
  popular: { path: "/movie/popular", type: "movie" },
  "top-rated": { path: "/movie/top_rated", type: "movie" },
  "in-cinema": { path: "/movie/now_playing", type: "movie" },
};

export async function GET(req: Request) {
  const category = (new URL(req.url).searchParams.get("category") ?? "") as Category;
  const shelf = SHELVES[category];
  if (!shelf) return Response.json({ error: "Unknown category" }, { status: 400 });
  try {
    const data = await tmdb(shelf.path, shelf.params ?? {}, 3600);
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
    return Response.json({ results });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
