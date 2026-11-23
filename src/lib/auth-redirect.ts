import { NextResponse, type NextRequest } from "next/server";

/** Only allow same-origin relative paths in ?next=. */
export function safeNext(next: string | null) {
  if (!next) return "/";
  try {
    const parsed = new URL(next, "https://tracker.invalid");
    if (parsed.origin !== "https://tracker.invalid") return "/";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

/** Respect the public host when running behind Vercel's proxy. */
export function publicOrigin(request: NextRequest, url: URL) {
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  // Only accept a plausible hostname; never trust a raw header value as the
  // scheme or host of a redirect (these headers are set by the proxy, but on
  // a self-hosted deployment they may be client-controlled).
  if (!host || !/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) return url.origin;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return `${proto === "http" ? "http" : "https"}://${host}`;
}

export function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
