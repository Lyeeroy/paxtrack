"use client";

import { useState } from "react";
import { isEmailAuth, normalizeUsername, USERNAME_HINT } from "@/lib/auth-config";
import {
  describeAuthError,
  displayName,
  resetPassword,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  useAuth,
} from "@/lib/auth";
import { syncNow, useSyncState } from "@/lib/sync";
import { showToast } from "@/lib/toast";

type Mode = "signin" | "signup" | "reset";

const inputClass =
  "mt-1.5 h-10 w-full rounded-lg bg-black px-3 text-[16px] outline-none placeholder:text-faint focus:ring-1 focus:ring-accent/60";

export default function CloudSync() {
  const auth = useAuth();
  const sync = useSyncState();
  const [mode, setMode] = useState<Mode>("signin");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const statusText =
    sync.status === "syncing"
      ? "Syncing…"
      : sync.status === "offline"
        ? "Offline · will sync later"
        : sync.status === "error"
          ? "Sync failed · try again"
          : sync.status === "unconfigured"
            ? "Cloud sync isn't configured"
            : sync.at
              ? `Synced ${new Date(sync.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
              : "Not synced yet";

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setMessage(null);
    setPassword("");
    setConfirm("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const raw = identifier.trim();
    if (!raw) {
      setError(isEmailAuth ? "Enter your email address." : "Enter a username.");
      return;
    }
    if (mode !== "reset" && password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (mode === "signup" && password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    const account = isEmailAuth ? raw : normalizeUsername(raw);
    if (mode !== "reset" && !isEmailAuth && !account) {
      setError(USERNAME_HINT);
      return;
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        await signInWithPassword(account!, password);
        showToast("Signed in");
        setPassword("");
      } else if (mode === "signup") {
        const { needsConfirmation } = await signUpWithPassword(account!, password);
        setPassword("");
        setConfirm("");
        if (needsConfirmation) {
          if (isEmailAuth) {
            setMode("signin");
            setMessage("Check your email to confirm your account, then sign in.");
          } else {
            setError("Email confirmation is on in Supabase. Turn off Confirm email for username mode, then sign in.");
          }
        } else {
          showToast("Account created");
        }
      } else {
        await resetPassword(raw);
        setMessage("Check your email for a password reset link.");
      }
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const doSignOut = async () => {
    try {
      await signOut();
      showToast("Signed out");
    } catch (err) {
      showToast(describeAuthError(err));
    }
  };

  return (
    <section className="px-4 pt-5">
      <h2 className="pb-2 text-[11px] font-medium uppercase tracking-wider text-faint">Cloud sync</h2>

      <div className="divide-y divide-line/70 overflow-hidden rounded-2xl bg-surface">
        {!auth.configured ? (
          <div className="px-4 py-3.5">
            <p className="text-[15px]">Cloud sync isn&apos;t configured</p>
            <p className="mt-0.5 text-xs leading-relaxed text-dim">
              Add <code className="text-faint">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code className="text-faint">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to this deployment, then
              restart it. See the README for setup.
            </p>
          </div>
        ) : !auth.ready ? (
          <div className="px-4 py-3.5 text-sm text-dim">Checking account…</div>
        ) : auth.user ? (
          <>
            <div className="flex items-center justify-between gap-3 px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-[15px]">Signed in</p>
                <p className="mt-0.5 truncate text-xs text-dim">{displayName(auth.user)}</p>
              </div>
              <button
                onClick={() => void doSignOut()}
                className="h-10 shrink-0 rounded-full border border-line px-4 text-sm text-dim active:bg-raised"
              >
                Sign out
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3.5">
              <div>
                <p className="text-[15px]">Backup &amp; sync</p>
                <p className="mt-0.5 text-xs text-dim" aria-live="polite">
                  {statusText}
                </p>
              </div>
              <button
                onClick={() => void syncNow()}
                disabled={sync.status === "syncing"}
                className="h-10 shrink-0 rounded-full border border-line px-4 text-sm text-accent active:bg-raised disabled:opacity-50"
              >
                Sync now
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={submit} className="px-4 py-3.5">
            <p className="text-[15px]">
              {mode === "signup" ? "Create an account" : mode === "reset" ? "Reset password" : "Sign in to sync"}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-dim">
              {mode === "signup"
                ? isEmailAuth
                  ? "Back up your library and pick it up on any device."
                  : "Pick a username and password — no email needed."
                : mode === "reset"
                  ? "We'll email you a link to choose a new password."
                  : "Your library stays on this device until you sign in. Sign in to back it up and sync across devices."}
            </p>

            <label htmlFor="sync-identifier" className="mt-3 block text-xs text-dim">
              {isEmailAuth ? "Email" : "Username"}
            </label>
            <input
              id="sync-identifier"
              type={isEmailAuth ? "email" : "text"}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={isEmailAuth ? "you@example.com" : "yourname"}
              autoComplete={isEmailAuth ? "email" : "username"}
              inputMode={isEmailAuth ? "email" : "text"}
              autoCapitalize="none"
              spellCheck={false}
              required
              className={inputClass}
            />
            {!isEmailAuth && mode === "signup" ? (
              <p className="mt-1 text-[11px] leading-relaxed text-faint">{USERNAME_HINT}</p>
            ) : null}

            {mode !== "reset" ? (
              <>
                <label htmlFor="sync-password" className="mt-3 block text-xs text-dim">
                  Password
                </label>
                <input
                  id="sync-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  minLength={8}
                  required
                  className={inputClass}
                />
              </>
            ) : null}

            {mode === "signup" ? (
              <>
                <label htmlFor="sync-confirm" className="mt-3 block text-xs text-dim">
                  Confirm password
                </label>
                <input
                  id="sync-confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className={inputClass}
                />
              </>
            ) : null}

            {error ? (
              <p role="alert" className="mt-3 text-xs leading-relaxed text-warn">
                {error}
              </p>
            ) : null}
            {message ? (
              <p aria-live="polite" className="mt-3 text-xs leading-relaxed text-accent">
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="mt-4 h-10 w-full rounded-full bg-fg text-sm font-medium text-black active:opacity-80 disabled:opacity-50"
            >
              {busy
                ? "Working…"
                : mode === "signup"
                  ? "Create account"
                  : mode === "reset"
                    ? "Send reset link"
                    : "Sign in"}
            </button>

            <div className="mt-3 flex items-center justify-between gap-3 text-xs">
              <button
                type="button"
                onClick={() => switchMode(mode === "signup" ? "signin" : "signup")}
                className="text-accent active:opacity-70"
              >
                {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
              </button>
              {isEmailAuth && mode === "signin" ? (
                <button type="button" onClick={() => switchMode("reset")} className="shrink-0 text-dim active:opacity-70">
                  Forgot password?
                </button>
              ) : null}
              {mode === "reset" ? (
                <button type="button" onClick={() => switchMode("signin")} className="shrink-0 text-dim active:opacity-70">
                  Back to sign in
                </button>
              ) : null}
            </div>
          </form>
        )}
      </div>

      {auth.configured ? (
        <p className="px-2 pt-2 text-[11px] leading-relaxed text-faint">
          {isEmailAuth
            ? "Accounts and recovery emails are handled by Supabase. Your library is protected by row-level security, so only you can read it."
            : "Accounts are handled by Supabase. Username mode never sends email; your library is protected by row-level security."}
        </p>
      ) : null}
    </section>
  );
}
