import { isAnime, tmdb } from "@/lib/tmdb-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  try {
    const data = q
      ? await tmdb("/search/multi", { query: q, include_adult: "false" }, 600)
      : await tmdb("/trending/all/week", {}, 3600);
    const results = (data.results as any[])
      .filter((r) => r.media_type === "tv" || r.media_type === "movie")
      .slice(0, 20)
      .map((r) => ({
        tmdbId: r.id as number,
        type: r.media_type as "tv" | "movie",
        title: (r.title ?? r.name ?? "") as string,
        year: String(r.release_date ?? r.first_air_date ?? "").slice(0, 4),
        poster: (r.poster_path ?? null) as string | null,
        anime: isAnime(r.genre_ids, r.original_language, r.origin_country),
      }));
    return Response.json({ results });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
