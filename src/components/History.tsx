"use client";

import { useMemo, useState } from "react";
import { flatEps, todayStr, addDays, relDay } from "@/lib/episodes";
import type { EpData, Item } from "@/lib/types";
import { Empty, Poster, ScreenHeader } from "./ui";

interface Entry {
  id: string;
  title: string;
  poster: string | null;
  ts: number;
  label: string;
  count: number;
}

function dayOf(ts: number) {
  return todayStr(new Date(ts));
}

export default function History({ items, eps, onOpen }: { items: Item[]; eps: Record<string, EpData>; onOpen: (id: string) => void }) {
  const [limit, setLimit] = useState(60);

  const { entries, total, week } = useMemo(() => {
    const raw: { it: Item; key: string; ts: number }[] = [];
    for (const it of items) for (const [key, ts] of Object.entries(it.watched)) raw.push({ it, key, ts });
    raw.sort((a, b) => b.ts - a.ts);

    const out: Entry[] = [];
    const names = new Map<string, Map<string, string>>();
    const nameOf = (it: Item, key: string) => {
      let m = names.get(it.id);
      if (!m) {
        m = new Map(flatEps(eps[it.id]).map((e) => [e.key, e.name]));
        names.set(it.id, m);
      }
      return m.get(key);
    };
    const fmt = (key: string) => (key === "m" ? "Movie" : key.replace("x", " E").replace(/^/, "S"));

    for (const r of raw) {
      const last = out[out.length - 1];
      // batch-marked episodes (same title, within 90s) collapse into one line
      if (last && last.id === r.it.id && last.ts - r.ts < 90_000) {
        last.count++;
        last.label = `${last.count} episodes`;
        continue;
      }
      const nm = r.key === "m" ? undefined : nameOf(r.it, r.key);
      out.push({
        id: r.it.id,
        title: r.it.title,
        poster: r.it.poster,
        ts: r.ts,
        label: nm ? `${fmt(r.key)} · ${nm}` : fmt(r.key),
        count: 1,
      });
    }
    // The weekly count is intentionally computed when this view renders; it
    // remounts when the user switches tabs.
    // eslint-disable-next-line react-hooks/purity
    const weekAgo = Date.now() - 7 * 86400000;
    return { entries: out, total: raw.length, week: raw.filter((r) => r.ts > weekAgo).length };
  }, [items, eps]);

  const today = todayStr();
  const shown = entries.slice(0, limit);

  return (
    <div>
      <ScreenHeader title="History" sub={total ? `${total} watched · ${week} this week` : undefined} />
      {!shown.length ? <Empty title="Nothing watched yet" hint="Episodes you mark as watched appear here." /> : null}
      <ul>
        {shown.map((e, i) => {
          const day = dayOf(e.ts);
          const header = i === 0 || day !== dayOf(shown[i - 1].ts);
          return (
            <li key={e.id + e.ts + i} className="cv">
              {header ? (
                <h2 className="px-4 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wider text-faint">
                  {day === today || day === addDays(today, -1) ? relDay(day, today) : new Date(e.ts).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                </h2>
              ) : null}
              <button onClick={() => onOpen(e.id)} className="flex w-full items-center gap-3 border-b border-line/60 px-4 py-2 text-left active:bg-surface">
                <Poster path={e.poster} title={e.title} w={32} h={46} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.title}</p>
                  <p className="truncate text-xs text-dim">{e.label}</p>
                </div>
                <time className="shrink-0 text-xs tabular-nums text-faint" dateTime={new Date(e.ts).toISOString()}>
                  {new Date(e.ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </time>
              </button>
            </li>
          );
        })}
      </ul>
      {entries.length > limit ? (
        <div className="flex justify-center py-6">
          <button onClick={() => setLimit(limit + 100)} className="h-10 rounded-full border border-line px-5 text-sm text-dim active:bg-raised">
            Show more
          </button>
        </div>
      ) : null}
    </div>
  );
}
