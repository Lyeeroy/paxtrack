"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ScreenHeader } from "@/components/ui";
import { isEmailAuth } from "@/lib/auth-config";
import { describeAuthError, initAuth, updatePassword, useAuth } from "@/lib/auth";
import { showToast } from "@/lib/toast";

export default function ResetPassword() {
  const auth = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void initAuth();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      showToast("Password updated");
      router.push("/");
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto min-h-dvh max-w-xl pb-10">
      <ScreenHeader title="New password" sub={auth.user?.email ?? "Choose a new password for your account"} />

      {!auth.ready ? (
        <p className="px-6 py-12 text-center text-sm text-dim">Checking your link…</p>
      ) : !auth.configured ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm text-dim">Cloud sync isn&apos;t configured for this deployment.</p>
          <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-full bg-fg px-6 text-sm font-medium text-black">
            Back to Tracker
          </Link>
        </div>
      ) : !isEmailAuth ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm text-dim">Password reset is only available when email sign-in is enabled.</p>
          <p className="mt-2 text-xs text-faint">This deployment uses username sign-in, so there is no email to send a reset link to.</p>
          <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-full bg-fg px-6 text-sm font-medium text-black">
            Back to Tracker
          </Link>
        </div>
      ) : !auth.user ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm text-dim">This reset link is invalid or has expired.</p>
          <p className="mt-2 text-xs text-faint">Open Settings in the app and request a new password reset email.</p>
          <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-full bg-fg px-6 text-sm font-medium text-black">
            Back to Tracker
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mx-4 mt-4 space-y-4 rounded-2xl bg-surface p-4">
          <div>
            <label htmlFor="new-password" className="text-xs text-dim">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              className="mt-1.5 h-11 w-full rounded-lg bg-black px-3 text-[16px] outline-none focus:ring-1 focus:ring-accent/60"
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="text-xs text-dim">
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              className="mt-1.5 h-11 w-full rounded-lg bg-black px-3 text-[16px] outline-none focus:ring-1 focus:ring-accent/60"
            />
          </div>
          {error ? (
            <p role="alert" className="text-xs leading-relaxed text-warn">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="h-11 w-full rounded-full bg-fg text-sm font-medium text-black active:opacity-80 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save new password"}
          </button>
        </form>
      )}
    </main>
  );
}
