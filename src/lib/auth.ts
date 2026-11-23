import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { isEmailAuth, normalizeUsername, usernameToEmail, USERNAME_HINT } from "./auth-config";
import { getSupabase, isSupabaseConfigured } from "./supabase/client";

/** The name shown in the UI for a signed-in account. */
export function displayName(user: User | null): string {
  if (!user) return "";
  const username = user.user_metadata?.username;
  if (typeof username === "string" && username) return username;
  return user.email?.split("@")[0] ?? "Account";
}

/** Resolve either a username (default mode) or an email address to a Supabase identifier. */
function identifierToEmail(identifier: string): string {
  if (isEmailAuth) return identifier.trim();
  const username = normalizeUsername(identifier);
  if (!username) throw new Error(USERNAME_HINT);
  return usernameToEmail(username);
}

export interface AuthState {
  /** False until the persisted session has been read. */
  ready: boolean;
  configured: boolean;
  user: User | null;
}

const INITIAL: AuthState = { ready: false, configured: isSupabaseConfigured, user: null };
let state: AuthState = INITIAL;
const listeners = new Set<() => void>();
const changeListeners = new Set<() => void>();
let initP: Promise<void> | null = null;
let subscribed = false;

function emit() {
  listeners.forEach((l) => l());
}

function emitChange() {
  changeListeners.forEach((l) => l());
}

function setState(patch: Partial<AuthState>) {
  state = { ...state, ...patch };
  emit();
}

export function useAuth(): AuthState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => INITIAL,
  );
}

/** Subscribe to real sign-in / sign-out events (not token refreshes). */
export function onAuthChange(cb: () => void) {
  changeListeners.add(cb);
  return () => {
    changeListeners.delete(cb);
  };
}

export function initAuth(): Promise<void> {
  if (initP) return initP;
  initP = (async () => {
    if (!isSupabaseConfigured) {
      setState({ ready: true, configured: false, user: null });
      return;
    }
    try {
      const supabase = getSupabase();
      if (!subscribed) {
        subscribed = true;
        supabase.auth.onAuthStateChange((event, session) => {
          setState({ ready: true, configured: true, user: session?.user ?? null });
          if (
            event === "INITIAL_SESSION" ||
            event === "SIGNED_IN" ||
            event === "SIGNED_OUT" ||
            event === "USER_UPDATED" ||
            event === "PASSWORD_RECOVERY"
          ) {
            emitChange();
          }
        });
      }
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      setState({ ready: true, configured: true, user: data.session?.user ?? null });
    } catch (e) {
      console.error("auth init failed", e);
      setState({ ready: true, configured: isSupabaseConfigured, user: null });
    }
  })();
  return initP;
}

export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  return data.session?.user ?? null;
}

export async function signInWithPassword(identifier: string, password: string) {
  const { error } = await getSupabase().auth.signInWithPassword({
    email: identifierToEmail(identifier),
    password,
  });
  if (error) throw error;
}

export async function signUpWithPassword(identifier: string, password: string) {
  const email = identifierToEmail(identifier);
  const options = isEmailAuth
    ? { emailRedirectTo: `${window.location.origin}/auth/callback` }
    : { data: { username: normalizeUsername(identifier) } };
  const { data, error } = await getSupabase().auth.signUp({ email, password, options });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}

export async function resetPassword(email: string) {
  if (!isEmailAuth) throw new Error("Password reset is only available in email mode.");
  const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/reset")}`,
  });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await getSupabase().auth.updateUser({ password });
  if (error) throw error;
}

/** Change the password while signed in, in both username and email mode. */
export async function changePassword(current: string, next: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Your session expired. Sign in again.");
  const identifier = isEmailAuth ? user.email : displayName(user);
  if (!identifier) throw new Error("Couldn't identify your account. Sign out and back in.");
  // Verifies the current password and refreshes the session first, so this
  // also works when Supabase requires a recent reauthentication.
  await signInWithPassword(identifier, current);
  await updatePassword(next);
}

export async function signOut() {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
}

/** Turn Supabase's technical errors into something a person can act on. */
export function describeAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/invalid login credentials/i.test(msg))
    return isEmailAuth ? "Wrong email or password." : "Wrong username or password.";
  if (!isEmailAuth && /invalid email|email.*invalid|unable to validate email/i.test(msg)) return USERNAME_HINT;
  if (isEmailAuth && /invalid email|email.*invalid format/i.test(msg)) return "Enter a valid email address.";
  if (/email not confirmed/i.test(msg)) return "Confirm your email first — check your inbox.";
  if (/auth session missing|session.*(expired|not found)/i.test(msg))
    return "Your session expired. Request a new link and try again.";
  if (/user already registered/i.test(msg))
    return isEmailAuth ? "That email already has an account. Sign in instead." : "That username is taken. Sign in instead.";
  if (/password should be at least/i.test(msg)) return "Use at least 8 characters for your password.";
  if (/email rate limit|rate limit exceeded/i.test(msg))
    return "Too many emails sent. Try again later, or configure SMTP in Supabase.";
  if (/failed to fetch|network/i.test(msg)) return "Can't reach Supabase. Check your connection and try again.";
  return msg;
}
