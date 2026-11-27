import { tmdb } from "@/lib/tmdb-server";
import type { CastMember, WatchInfo } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Region for watch providers. Accept-Language is the only per-user input; the
 * region is part of the TMDB cache key so one user's locale cannot leak into
 * another's cached response. */
function regionFrom(req: Request): string {
  const first = (req.headers.get("accept-language") ?? "").split(",")[0] ?? "";
  try {
    return new Intl.Locale(first.split(";")[0].trim()).region || "US";
  } catch {
    return "US";
  }
}

function castFrom(value: unknown): CastMember[] {
  const list = (value as { cast?: unknown[] } | undefined)?.cast ?? [];
  return (list as Record<string, unknown>[])
    .slice(0, 12)
    .map((c) => ({
      name: String(c.name ?? ""),
      character: c.character ? String(c.character) : null,
      profile: typeof c.profile_path === "string" ? c.profile_path : null,
    }))
    .filter((c) => c.name);
}

function watchFrom(value: unknown, region: string): WatchInfo | null {
  const regions = value as Record<string, Record<string, unknown>> | undefined;
  const r = regions?.[region] ?? regions?.US;
  if (!r) return null;
  const names = (key: string) =>
    ((r[key] as Record<string, unknown>[] | undefined) ?? [])
      .map((p) => String(p.provider_name ?? ""))
      .filter(Boolean)
      .slice(0, 10);
  return {
    country: region,
    link: typeof r.link === "string" ? r.link : null,
    flatrate: names("flatrate"),
    free: [...names("free"), ...names("ads")],
    rent: names("rent"),
    buy: names("buy"),
  };
}

/** Watch providers are a separate v3 endpoint; append_to_response ignores it. */
async function loadWatch(type: "movie" | "tv", id: number, region: string): Promise<WatchInfo | null> {
  try {
    const r = await tmdb(`/${type}/${id}/watch/providers`, { region }, 3600);
    return watchFrom(r.results, region);
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const type = sp.get("type");
  const id = Number(sp.get("id"));
  if (!id || (type !== "tv" && type !== "movie")) {
    return Response.json({ error: "bad params" }, { status: 400 });
  }
  const region = regionFrom(req);
  const extra = { append_to_response: "external_ids,credits", region };
  try {
    if (type === "movie") {
      const m = await tmdb(`/movie/${id}`, extra, 3600);
      return Response.json({
        type,
        tmdbId: id,
        title: m.title,
        poster: m.poster_path ?? null,
        releaseDate: m.release_date || null,
        runtime: m.runtime ?? null,
        overview: m.overview || null,
        genres: (m.genres ?? []).map((g: any) => g.name as string).filter(Boolean),
        voteAverage: m.vote_average ?? null,
        anime: (m.genres ?? []).some((g: any) => g.id === 16) && m.original_language === "ja",
        imdbId: (m.external_ids as any)?.imdb_id ?? null,
        cast: castFrom(m.credits),
        watch: await loadWatch("movie", id, region),
        seasons: [],
        status: m.status,
      });
    }

    const d = await tmdb(`/tv/${id}`, extra, 3600);
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
      overview: d.overview || null,
      genres: (d.genres ?? []).map((g: any) => g.name as string).filter(Boolean),
      voteAverage: d.vote_average ?? null,
      runtime: (d.episode_run_time as number[] | undefined)?.[0] ?? null,
      imdbId: (d.external_ids as any)?.imdb_id ?? null,
      cast: castFrom(d.credits),
      watch: await loadWatch("tv", id, region),
      seasons,
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
