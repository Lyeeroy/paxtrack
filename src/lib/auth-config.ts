/**
 * Authentication mode for the whole deployment.
 *
 * `username` (the default) signs users up with a username and password and
 * never sends an email. `email` keeps the original email/password flow with
 * Supabase confirmation and password-reset emails.
 */
const rawMode = (process.env.NEXT_PUBLIC_AUTH_MODE ?? "").trim().toLowerCase();
export const authMode: "username" | "email" = rawMode === "email" ? "email" : "username";
export const isEmailAuth = authMode === "email";

/** Usernames are 3-20 characters: a letter, then letters, digits or underscores. */
export const USERNAME_HINT = "3–20 characters: a letter, then letters, numbers or underscores.";

export function normalizeUsername(value: string): string | null {
  const v = value.trim().toLowerCase();
  return /^[a-z][a-z0-9_]{2,19}$/.test(v) ? v : null;
}

/**
 * Supabase Auth signs in with an email address. In username mode we derive a
 * non-deliverable address from the username so no real email is needed. Email
 * confirmation must be disabled in Supabase for this mode.
 */
export const USERNAME_EMAIL_DOMAIN = "users.example.com";

export function usernameToEmail(username: string) {
  return `${username}@${USERNAME_EMAIL_DOMAIN}`;
}
