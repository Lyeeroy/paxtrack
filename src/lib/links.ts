import type { MediaType } from "./types";

const CUSTOM_LINKS_KEY = "tracker:customLinks";
const EMPTY_TEMPLATES: string[] = [];

/** A bare TMDB URL is valid on its own and shows that `{…}` tokens are supported. */
export const DEFAULT_TEMPLATE = "{tmdburl}";

/** Tokens offered in the Links page and substituted by expandTemplate(). */
export const TEMPLATE_TOKENS = ["{tmdburl}", "{tmdbid}", "{media}", "{season}", "{episode}", "{name}", "{imdbid}"] as const;

export interface LinkContext {
  type: MediaType;
  tmdbId: number;
  title: string;
  season: number;
  episode: number;
  imdbId?: string | null;
}

/** Saved custom links are templates, not frozen URLs: expandTemplate() runs
 * on use so {season}/{episode} follow the library's current progress. */
export function getCustomLinks(): string[] {
  if (typeof window === "undefined") return EMPTY_TEMPLATES;
  try {
    const raw = localStorage.getItem(CUSTOM_LINKS_KEY);
    if (!raw) return EMPTY_TEMPLATES;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((link): link is string => typeof link === "string") : EMPTY_TEMPLATES;
  } catch {
    return EMPTY_TEMPLATES;
  }
}

export function saveCustomLinks(templates: string[]) {
  try {
    if (templates.length) localStorage.setItem(CUSTOM_LINKS_KEY, JSON.stringify(templates));
    else localStorage.removeItem(CUSTOM_LINKS_KEY);
  } catch {
    // Private mode / storage disabled: the links still work for this session.
  }
}

export function tmdbUrl(ctx: LinkContext) {
  return `https://www.themoviedb.org/${ctx.type}/${ctx.tmdbId}`;
}

export function imdbUrl(imdbId: string | null | undefined) {
  return imdbId ? `https://www.imdb.com/title/${encodeURIComponent(imdbId)}/` : null;
}

/** Trakt resolves IMDb ids through /search/imdb; fall back to a title search. */
export function traktUrl(ctx: LinkContext) {
  return ctx.imdbId
    ? `https://trakt.tv/search/imdb/${encodeURIComponent(ctx.imdbId)}`
    : `https://trakt.tv/search?query=${encodeURIComponent(ctx.title)}`;
}

/** Expand a user template and reject anything that is not an http(s) URL. */
export function expandTemplate(template: string, ctx: LinkContext): string | null {
  const values: Record<string, string> = {
    tmdburl: tmdbUrl(ctx),
    tmdbid: String(ctx.tmdbId),
    media: ctx.type,
    season: String(ctx.season),
    episode: String(ctx.episode),
    name: encodeURIComponent(ctx.title),
    imdbid: ctx.imdbId ?? "",
  };
  const raw = template.replace(/\{([a-z0-9]+)\}/gi, (match, key: string) => {
    const value = values[key.toLowerCase()];
    return value === undefined ? match : value;
  });
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
