# 0003 — Username auth mode as the default

- Date: 2026-11-23 (recorded from the existing implementation)
- Status: accepted

## Context

The project wants accounts with minimal friction and no email dependency. Supabase Auth always signs in with an email address and, by default, sends confirmation and password-reset emails. Requiring a real inbox would exclude users and add SMTP configuration to the setup.

## Decision

`NEXT_PUBLIC_AUTH_MODE` defaults to `username`, implemented in `src/lib/auth-config.ts` and `src/lib/auth.ts`:

- A username (3–20 chars, starting with a letter) is normalized and mapped to a private, non-deliverable address `<username>@users.example.com`.
- The human-readable username is kept in `user_metadata` and shown in the UI via `displayName()`.
- Supabase's **Confirm email** must be disabled for this mode. Password reset is unavailable (no inbox); instead, changing a password while signed in re-authenticates with the current password.

An opt-in `email` mode keeps the conventional Supabase flow with confirmation and reset emails.

## Consequences

- No email/SMTP setup is needed for the default deployment; sign-up is immediate.
- Email confirmation being enabled in Supabase breaks sign-up in username mode — a common setup error documented in the root README and `05-gotchas.md`.
- An account created in one mode signs in with that mode's identifier; switching modes later does not migrate accounts.
- `email` mode still needs Site URL and Redirect URLs configured, and PKCE links remain browser-bound.
