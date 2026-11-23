/**
 * Supabase's public client credentials. Both values are safe to ship to the
 * browser: Row Level Security in Postgres is what protects user data.
 *
 * Never put the service role key in a NEXT_PUBLIC_ variable.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

// New projects issue a publishable key. Older projects can keep using the
// legacy anon key, so accept either name. Empty strings fall through.
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);
