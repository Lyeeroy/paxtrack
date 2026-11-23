import { NextResponse, type NextRequest } from "next/server";
import { noStore, publicOrigin, safeNext } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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
