"use client";

import { useEffect, useState } from "react";
import { allItemsRaw } from "@/lib/store";
import { notificationsEnabled, notificationsSupported, setNotificationsEnabled } from "@/lib/notify";
import { ensureSyncKey, formatKey, linkKey, syncNow, useSyncState } from "@/lib/sync";
import { showToast } from "@/lib/toast";
import { ScreenHeader } from "./ui";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-4 pt-5">
      <h2 className="pb-2 text-[11px] font-medium uppercase tracking-wider text-faint">{title}</h2>
      <div className="divide-y divide-line/70 overflow-hidden rounded-2xl bg-surface">{children}</div>
    </section>
  );
}

export default function Settings() {
  const sync = useSyncState();
  const [key, setKey] = useState("");
  const [reveal, setReveal] = useState(false);
  const [link, setLink] = useState("");
  const [notif, setNotif] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setKey(ensureSyncKey());
    setNotif(notificationsEnabled());
    setSupported(notificationsSupported());
  }, []);

  const statusText =
    sync.status === "syncing"
      ? "Syncing…"
      : sync.status === "offline"
        ? "Offline · will sync later"
        : sync.status === "error"
          ? "Sync failed · retry"
          : sync.at
            ? `Synced ${new Date(sync.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
            : "Not synced yet";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatKey(key));
      showToast("Sync key copied");
    } catch {
      setReveal(true);
    }
  };

  const doLink = () => {
    if (!linkKey(link)) {
      showToast("That key looks too short");
      return;
    }
    setKey(ensureSyncKey());
    setLink("");
    showToast("Linked. Syncing…");
    void syncNow();
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), items: allItemsRaw().filter((i) => !i.deleted) }, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tracker-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <div className="pb-8">
      <ScreenHeader title="Settings" />

      <Section title="Cloud sync">
        <div className="flex items-center justify-between px-4 py-3.5">
          <div>
            <p className="text-[15px]">Backup &amp; sync</p>
            <p className="mt-0.5 text-xs text-dim" aria-live="polite">
              {statusText}
            </p>
          </div>
          <button onClick={() => void syncNow()} className="h-10 rounded-full border border-line px-4 text-sm text-accent active:bg-raised">
            Sync now
          </button>
        </div>
        <div className="px-4 py-3.5">
          <p className="text-[15px]">Your sync key</p>
          <p className="mt-0.5 text-xs text-dim">Enter this key on another device to share your library.</p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex min-w-0 flex-1 items-center truncate rounded-lg bg-black px-3 py-2.5 font-mono text-[13px] tracking-wide">
              {reveal ? formatKey(key) : "••••-••••-••••-••••-••••"}
            </code>
            <button onClick={() => setReveal((r) => !r)} className="h-10 rounded-full px-3 text-xs text-dim active:bg-raised">
              {reveal ? "Hide" : "Show"}
            </button>
            <button onClick={copy} className="h-10 rounded-full px-3 text-xs text-accent active:bg-raised">
              Copy
            </button>
          </div>
        </div>
        <div className="px-4 py-3.5">
          <p className="text-[15px]">Link another device</p>
          <div className="mt-3 flex gap-2">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
              aria-label="Sync key from another device"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="h-10 min-w-0 flex-1 rounded-lg bg-black px-3 font-mono text-[16px] outline-none placeholder:text-faint focus:ring-1 focus:ring-accent/60"
            />
            <button onClick={doLink} className="h-10 rounded-full bg-fg px-4 text-sm font-medium text-black active:opacity-80">
              Link
            </button>
          </div>
          <p className="mt-2 text-[11px] text-faint">Linking merges both libraries. The most recent change to each title wins.</p>
        </div>
      </Section>

      <Section title="Alerts">
        <div className="flex items-center justify-between px-4 py-3.5">
          <div>
            <p className="text-[15px]">Release notifications</p>
            <p className="mt-0.5 text-xs text-dim">{supported ? "Episodes and movies you track, on release day." : "Not supported in this browser. On iPhone, add to Home Screen first."}</p>
          </div>
          <button
            role="switch"
            aria-checked={notif}
            aria-label="Release notifications"
            disabled={!supported}
            onClick={async () => setNotif(await setNotificationsEnabled(!notif))}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${notif ? "bg-accent" : "bg-raised"}`}
          >
            <span className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${notif ? "translate-x-5" : ""}`} />
          </button>
        </div>
      </Section>

      <Section title="Data">
        <button onClick={exportData} className="flex w-full items-center justify-between px-4 py-3.5 text-left active:bg-raised">
          <span className="text-[15px]">Export backup (JSON)</span>
        </button>
      </Section>

      <Section title="Gestures">
        <ul className="space-y-1.5 px-4 py-3.5 text-[13px] text-dim">
          <li>Swipe a title → mark next episode watched</li>
          <li>Swipe a title ← undo last episode</li>
          <li>Swipe an episode → mark everything up to it</li>
          <li>Swipe the screen ←/→ to switch tabs</li>
          <li>Swipe from the left edge to go back</li>
        </ul>
      </Section>

      <p className="px-6 pt-8 text-center text-[11px] leading-relaxed text-faint">
        Works offline · data stays on your device first.
        <br />
        Metadata from TMDB. This product is not endorsed by TMDB.
      </p>
    </div>
  );
}
