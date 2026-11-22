const BASE = "https://api.themoviedb.org/3";

export async function tmdb<T = any>(path: string, params: Record<string, string> = {}, revalidate = 3600): Promise<T> {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY missing");
  const qs = new URLSearchParams({ api_key: key, language: "en-US", ...params });
  const res = await fetch(`${BASE}${path}?${qs}`, { next: { revalidate } });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

export function isAnime(genreIds: number[] | undefined, lang: string | undefined, country?: string[]) {
  const animation = (genreIds ?? []).includes(16);
  return animation && (lang === "ja" || (country ?? []).includes("JP"));
}
