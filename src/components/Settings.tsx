"use client";

import { useEffect, useRef, useState } from "react";
import { parseBackup } from "@/lib/backup";
import { notificationsEnabled, notificationsSupported, setNotificationsEnabled } from "@/lib/notify";
import { createBackup, importBackup } from "@/lib/store";
import { showToast } from "@/lib/toast";
import CloudSync from "./CloudSync";
import { IconCopy, IconDownload, IconUpload, ScreenHeader } from "./ui";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-4 pt-5">
      <h2 className="pb-2 text-[11px] font-medium uppercase tracking-wider text-faint">{title}</h2>
      <div className="divide-y divide-line/70 overflow-hidden rounded-2xl bg-surface">{children}</div>
    </section>
  );
}

export default function Settings() {
  const [notif, setNotif] = useState(false);
  const [supported, setSupported] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- notification APIs only exist in the browser */
    setNotif(notificationsEnabled());
    setSupported(notificationsSupported());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const backupJson = () => JSON.stringify(createBackup(), null, 2);

  const downloadBackup = () => {
    const blob = new Blob([backupJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tracker-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const copyBackup = async () => {
    const json = backupJson();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(json);
      } else {
        // Clipboard API is unavailable on insecure origins; fall back to a
        // temporary textarea so Copy still works there.
        const ta = document.createElement("textarea");
        ta.value = json;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        if (!ok) throw new Error("copy failed");
      }
      showToast("Backup JSON copied");
    } catch {
      showToast("Couldn't copy — use Download instead");
    }
  };

  const importData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const { items, eps } = parseBackup(await file.text());
      const { applied, eps: episodeLists, total } = await importBackup(items, eps);
      const restored = [
        applied ? `${applied} title${applied === 1 ? "" : "s"}` : null,
        episodeLists ? `${episodeLists} episode list${episodeLists === 1 ? "" : "s"}` : null,
      ].filter(Boolean);
      showToast(
        restored.length
          ? `Restored ${restored.join(" and ")}`
          : total
            ? "Backup is older than your library — nothing restored"
            : "Backup has no titles",
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't read that backup");
    }
  };

  return (
    <div className="pb-8">
      <ScreenHeader title="Settings" />

      <CloudSync />

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
        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <span className="text-[15px]">Export backup (JSON)</span>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={downloadBackup}
              aria-label="Download backup JSON"
              title="Download JSON"
              className="rounded-lg p-2 text-dim active:bg-raised"
            >
              <IconDownload className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => void copyBackup()}
              aria-label="Copy backup JSON"
              title="Copy JSON"
              className="rounded-lg p-2 text-dim active:bg-raised"
            >
              <IconCopy className="h-5 w-5" />
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center justify-between px-4 py-3.5 text-left active:bg-raised"
        >
          <span className="text-[15px]">Import backup (JSON)</span>
          <IconUpload className="h-5 w-5 shrink-0 text-dim" />
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={(e) => void importData(e)} className="hidden" aria-label="Choose a backup JSON file" />
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
