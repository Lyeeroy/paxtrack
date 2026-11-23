import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Only allow same-origin relative paths in ?next=. */
function safeNext(next: string | null) {
  if (!next) return "/";
  try {
    const parsed = new URL(next, "https://tracker.invalid");
    if (parsed.origin !== "https://tracker.invalid") return "/";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/** Respect the public host when running behind Vercel's proxy. */
function publicOrigin(request: NextRequest, url: URL) {
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  // Only accept a plausible hostname; never trust a raw header value as the
  // scheme or host of a redirect (these headers are set by the proxy, but on
  // a self-hosted deployment they may be client-controlled).
  if (!host || !/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) return url.origin;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return `${proto === "http" ? "http" : "https"}://${host}`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = publicOrigin(request, url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return noStore(NextResponse.redirect(new URL(next, origin)));
      console.error("auth code exchange failed", error);
    } catch (e) {
      console.error("auth callback failed", e);
    }
  }

  const errorUrl = new URL("/auth/error", origin);
  const reason = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (reason) errorUrl.searchParams.set("reason", reason);
  return noStore(NextResponse.redirect(errorUrl));
}
