"use client";

import { memo, useMemo, useState } from "react";
import { formatEp, relDay, statsFor } from "@/lib/episodes";
import { quickUnwatch, quickWatch } from "@/lib/actions";
import type { EpData, Item, Status } from "@/lib/types";
import { Empty, IconCheck, IconPlus, Poster, Progress, ScreenHeader, SwipeRow, TypeTag } from "./ui";

const FILTERS: { id: Status; label: string }[] = [
  { id: "watching", label: "Watching" },
  { id: "planned", label: "Planned" },
  { id: "completed", label: "Done" },
  { id: "dropped", label: "Dropped" },
];

let lastFilter: Status = "watching";

const Card = memo(function Card({ item, data, onOpen }: { item: Item; data: EpData | undefined; onOpen: (id: string) => void }) {
  const st = statsFor(item, data);
  let sub: string;
  if (item.type === "movie") {
    sub = item.watched.m ? "Watched" : item.releaseDate && st.aired === 0 ? `Releases ${relDay(item.releaseDate)}` : "Not watched";
  } else if (!data) {
    sub = "Loading episodes…";
  } else if (st.next) {
    sub = `Next ${formatEp(st.next)}${st.backlog > 1 ? ` · ${st.backlog} behind` : ""}`;
  } else if (st.upcoming?.air) {
    sub = `${formatEp(st.upcoming)} · ${relDay(st.upcoming.air)}`;
  } else {
    sub = st.watched >= st.total && st.total > 0 ? "Caught up" : "No episodes";
  }
  const canWatch = item.type === "movie" ? !item.watched.m && st.aired > 0 : !!st.next;
  const count = item.type === "movie" ? "" : `${st.watched}/${st.aired || st.total}`;

  return (
    <li className="cv border-b border-line/60">
      <SwipeRow
        onSwipeRight={() => quickWatch(item, data)}
        onSwipeLeft={() => quickUnwatch(item, data)}
        rightLabel="+1 watched"
        leftLabel="Undo last"
      >
        <div className="flex items-center gap-3 px-4 py-2.5">
          <button onClick={() => onOpen(item.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`${item.title}. ${sub}. Open details`}>
            <Poster path={item.poster} title={item.title} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-[15px] font-medium">{item.title}</p>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-dim">
                <TypeTag anime={item.anime} type={item.type} />
                <span className="truncate">{sub}</span>
                {count ? <span className="ml-auto shrink-0 tabular-nums text-faint">{count}</span> : null}
              </div>
              <div className="mt-2">
                <Progress value={st.progress} label={`${item.title} progress`} />
              </div>
            </div>
          </button>
          <button
            onClick={() => quickWatch(item, data)}
            disabled={!canWatch}
            aria-label={item.type === "movie" ? `Mark ${item.title} watched` : `Mark next episode of ${item.title} watched`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-accent active:bg-raised disabled:text-faint disabled:opacity-40"
          >
            {item.type === "movie" && item.watched.m ? <IconCheck /> : <IconPlus />}
          </button>
        </div>
      </SwipeRow>
    </li>
  );
});

function activity(i: Item) {
  let m = i.addedAt;
  for (const k in i.watched) if (i.watched[k] > m) m = i.watched[k];
  return m;
}

export default function Library({
  items,
  eps,
  onOpen,
  goSearch,
}: {
  items: Item[];
  eps: Record<string, EpData>;
  onOpen: (id: string) => void;
  goSearch: () => void;
}) {
  const [filter, setFilterState] = useState<Status>(lastFilter);
  const setFilter = (f: Status) => {
    lastFilter = f;
    setFilterState(f);
  };

  const counts = useMemo(() => {
    const c: Record<Status, number> = { watching: 0, planned: 0, completed: 0, dropped: 0 };
    items.forEach((i) => c[i.status]++);
    return c;
  }, [items]);

  const list = useMemo(() => {
    return items
      .filter((i) => i.status === filter)
      .map((i) => ({ i, backlog: statsFor(i, eps[i.id]).backlog > 0 ? 1 : 0, a: activity(i) }))
      .sort((x, y) => y.backlog - x.backlog || y.a - x.a)
      .map((x) => x.i);
  }, [items, eps, filter]);

  return (
    <div>
      <ScreenHeader title="Library" sub={`${items.length} ${items.length === 1 ? "title" : "titles"}`} />
      <div role="tablist" aria-label="Filter by status" className="flex flex-wrap gap-1.5 px-4 pb-3 pt-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`h-9 rounded-full px-3.5 text-[13px] ${
              filter === f.id ? "bg-fg font-medium text-black" : "bg-surface text-dim active:bg-raised"
            }`}
          >
            {f.label}
            <span className={`ml-1.5 tabular-nums ${filter === f.id ? "text-black/50" : "text-faint"}`}>{counts[f.id]}</span>
          </button>
        ))}
      </div>
      {list.length ? (
        <>
          <ul>
            {list.map((i) => (
              <Card key={i.id} item={i} data={eps[i.id]} onOpen={onOpen} />
            ))}
          </ul>
          <p className="px-6 py-6 text-center text-[11px] text-faint">Swipe → to mark next episode · ← to undo</p>
        </>
      ) : (
        <div>
          <Empty
            title={items.length ? `Nothing in ${FILTERS.find((f) => f.id === filter)?.label}` : "Your library is empty"}
            hint={items.length ? undefined : "Search for a show, anime or movie to start tracking."}
          />
          {!items.length ? (
            <div className="flex justify-center">
              <button onClick={goSearch} className="h-11 rounded-full bg-fg px-6 text-sm font-medium text-black active:opacity-80">
                Find something to watch
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
