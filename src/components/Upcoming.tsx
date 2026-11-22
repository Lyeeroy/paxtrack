"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, flatEps, formatEp, relDay, todayStr } from "@/lib/episodes";
import { notificationsEnabled, notificationsSupported, setNotificationsEnabled } from "@/lib/notify";
import type { EpData, Item } from "@/lib/types";
import { Empty, Poster, ScreenHeader } from "./ui";

interface Row {
  id: string;
  title: string;
  poster: string | null;
  date: string;
  label: string;
}

export default function Upcoming({ items, eps, onOpen }: { items: Item[]; eps: Record<string, EpData>; onOpen: (id: string) => void }) {
  const [notif, setNotif] = useState(false);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setNotif(notificationsEnabled());
    setSupported(notificationsSupported());
  }, []);

  const { fresh, soon } = useMemo(() => {
    const today = todayStr();
    const weekAgo = addDays(today, -7);
    const horizon = addDays(today, 90);
    const fresh: Row[] = [];
    const soon: Row[] = [];
    for (const it of items) {
      if (it.status !== "watching" && it.status !== "planned") continue;
      if (it.type === "movie") {
        const d = it.releaseDate;
        if (!d || it.watched.m) continue;
        if (d > today && d <= horizon) soon.push({ id: it.id, title: it.title, poster: it.poster, date: d, label: "Movie release" });
        else if (d <= today && d >= weekAgo) fresh.push({ id: it.id, title: it.title, poster: it.poster, date: d, label: "Movie · out now" });
        continue;
      }
      const list = flatEps(eps[it.id]);
      let newest: (typeof list)[number] | null = null;
      let n = 0;
      let up: (typeof list)[number] | null = null;
      for (const e of list) {
        if (!e.air) continue;
        if (e.air > today) {
          if (!up && e.air <= horizon) up = e;
        } else if (e.air >= weekAgo && !it.watched[e.key]) {
          newest = e;
          n++;
        }
      }
      if (newest?.air) fresh.push({ id: it.id, title: it.title, poster: it.poster, date: newest.air, label: formatEp(newest) + (n > 1 ? ` +${n - 1} more` : "") });
      if (up?.air) soon.push({ id: it.id, title: it.title, poster: it.poster, date: up.air, label: formatEp(up) });
    }
    fresh.sort((a, b) => b.date.localeCompare(a.date));
    soon.sort((a, b) => a.date.localeCompare(b.date));
    return { fresh, soon };
  }, [items, eps]);

  const groups = useMemo(() => {
    const g: { date: string; rows: Row[] }[] = [];
    for (const r of soon) {
      const last = g[g.length - 1];
      if (last && last.date === r.date) last.rows.push(r);
      else g.push({ date: r.date, rows: [r] });
    }
    return g;
  }, [soon]);

  const row = (r: Row) => (
    <li key={r.id + r.date} className="cv border-b border-line/60">
      <button onClick={() => onOpen(r.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface">
        <Poster path={r.poster} title={r.title} w={36} h={52} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium">{r.title}</p>
          <p className="mt-0.5 text-xs text-dim">{r.label}</p>
        </div>
        <span className="shrink-0 text-xs text-faint">{relDay(r.date)}</span>
      </button>
    </li>
  );

  return (
    <div>
      <ScreenHeader title="Upcoming" sub="Releases for what you track" />
      {supported && !notif ? (
        <button
          onClick={async () => setNotif(await setNotificationsEnabled(true))}
          className="mx-4 mb-3 mt-1 flex h-11 w-[calc(100%-2rem)] items-center justify-between rounded-xl bg-surface px-4 text-sm text-dim active:bg-raised"
        >
          Turn on release alerts <span className="text-accent">Enable</span>
        </button>
      ) : null}

      {fresh.length ? (
        <section>
          <h2 className="px-4 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-accent">New to watch</h2>
          <ul>{fresh.map(row)}</ul>
        </section>
      ) : null}

      {groups.map((g) => (
        <section key={g.date}>
          <h2 className="px-4 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wider text-faint">{relDay(g.date)}</h2>
          <ul>{g.rows.map(row)}</ul>
        </section>
      ))}

      {!fresh.length && !groups.length ? (
        <Empty title="Nothing scheduled" hint="Episodes and movie releases for titles in Watching or Planned will show up here." />
      ) : null}
    </div>
  );
}
