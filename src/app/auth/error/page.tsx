import Link from "next/link";

export const metadata = { title: "Sign-in error · Tracker" };

export default async function AuthError({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center">
      <h1 className="text-[26px] font-semibold tracking-tight">Sign-in link failed</h1>
      <p className="mt-3 text-sm leading-relaxed text-dim">
        The link may have expired, or it was opened in a different browser than the one you signed up in.
      </p>
      {reason ? (
        <p className="mt-4 break-words rounded-xl bg-surface px-4 py-3 text-xs leading-relaxed text-faint">{reason}</p>
      ) : null}
      <p className="mt-4 text-sm leading-relaxed text-dim">
        If you already confirmed your email, go back and sign in with your email and password.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex h-11 items-center justify-center rounded-full bg-fg px-6 text-sm font-medium text-black active:opacity-80"
      >
        Back to Tracker
      </Link>
    </main>
  );
}
