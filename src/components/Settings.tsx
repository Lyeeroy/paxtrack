"use client";

import { useEffect, useState } from "react";
import { allItemsRaw } from "@/lib/store";
import { notificationsEnabled, notificationsSupported, setNotificationsEnabled } from "@/lib/notify";
import CloudSync from "./CloudSync";
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
  const [notif, setNotif] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- notification APIs only exist in the browser */
    setNotif(notificationsEnabled());
    setSupported(notificationsSupported());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

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
