import { tmdb } from "@/lib/tmdb-server";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const type = sp.get("type");
  const id = Number(sp.get("id"));
  if (!id || (type !== "tv" && type !== "movie")) {
    return Response.json({ error: "bad params" }, { status: 400 });
  }
  try {
    if (type === "movie") {
      const m = await tmdb(`/movie/${id}`, {}, 3600);
      return Response.json({
        type,
        tmdbId: id,
        title: m.title,
        poster: m.poster_path ?? null,
        releaseDate: m.release_date || null,
        runtime: m.runtime ?? null,
        anime: (m.genres ?? []).some((g: any) => g.id === 16) && m.original_language === "ja",
        seasons: [],
        status: m.status,
      });
    }

    const d = await tmdb(`/tv/${id}`, {}, 3600);
    const seasonNums: number[] = (d.seasons as any[])
      .map((s) => s.season_number as number)
      .filter((n) => n > 0);
    const seasons: { n: number; eps: { e: number; name: string; air: string | null }[] }[] = [];
    for (let i = 0; i < seasonNums.length; i += 15) {
      const chunk = seasonNums.slice(i, i + 15);
      const append = chunk.map((n) => `season/${n}`).join(",");
      const r = await tmdb(`/tv/${id}`, { append_to_response: append }, 3600);
      for (const n of chunk) {
        const s = r[`season/${n}`];
        if (!s) continue;
        seasons.push({
          n,
          eps: (s.episodes as any[]).map((e) => ({
            e: e.episode_number as number,
            name: (e.name ?? `Episode ${e.episode_number}`) as string,
            air: (e.air_date ?? null) as string | null,
          })),
        });
      }
    }
    return Response.json({
      type,
      tmdbId: id,
      title: d.name,
      poster: d.poster_path ?? null,
      anime:
        (d.genres ?? []).some((g: any) => g.id === 16) &&
        (d.original_language === "ja" || (d.origin_country ?? []).includes("JP")),
      status: d.status,
      seasons,
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
