import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { noStore, publicOrigin, safeNext } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Server-side email verification for custom auth email templates.
 *
 * Supabase's default template links to its own /auth/v1/verify endpoint. If
 * you point the template at this route instead, the link stays on your domain
 * and the session is written as a cookie before we redirect into the app.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = publicOrigin(request, url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") || "email") as EmailOtpType;
  const next = safeNext(url.searchParams.get("next"));

  if (tokenHash) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (!error) return noStore(NextResponse.redirect(new URL(next, origin)));
      console.error("email verification failed", error);
    } catch (e) {
      console.error("auth confirm failed", e);
    }
  }

  const errorUrl = new URL("/auth/error", origin);
  const reason = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (reason) errorUrl.searchParams.set("reason", reason);
  return noStore(NextResponse.redirect(errorUrl));
}
