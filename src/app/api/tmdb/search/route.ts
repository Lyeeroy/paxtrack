import { isAnime, tmdb } from "@/lib/tmdb-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const raw = Number(url.searchParams.get("page") ?? "1");
  // No app-side ceiling: the user can pull results until TMDB runs out.
  const page = Number.isFinite(raw) ? Math.max(Math.floor(raw), 1) : 1;
  try {
    const data = q
      ? await tmdb("/search/multi", { query: q, include_adult: "false", page: String(page) }, 600)
      : await tmdb("/trending/all/week", { page: String(page) }, 3600);
    const results = (data.results as any[])
      .filter((r) => r.media_type === "tv" || r.media_type === "movie")
      .map((r) => ({
        tmdbId: r.id as number,
        type: r.media_type as "tv" | "movie",
        title: (r.title ?? r.name ?? "") as string,
        year: String(r.release_date ?? r.first_air_date ?? "").slice(0, 4),
        poster: (r.poster_path ?? null) as string | null,
        anime: isAnime(r.genre_ids, r.original_language, r.origin_country),
      }));
    return Response.json({
      results,
      page: (data.page as number) || page,
      totalPages: (data.total_pages as number) || 1,
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
