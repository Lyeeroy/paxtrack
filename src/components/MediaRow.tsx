"use client";

import { useState, type CSSProperties } from "react";
import { refreshItem } from "@/lib/refresh";
import { addItem, createPreview } from "@/lib/store";
import { haptic, showToast } from "@/lib/toast";
import type { Item, SearchResult, Status } from "@/lib/types";
import { IconPlus, Poster, TypeTag } from "./ui";

const STATUSES: { id: Status; label: string }[] = [
  { id: "watching", label: "Watching" },
  { id: "planned", label: "Planned" },
  { id: "completed", label: "Done" },
  { id: "dropped", label: "Dropped" },
];

/** A searchable title row: tap the poster to open details, tap + for the four statuses. */
export default function MediaRow({
  result,
  have,
  onOpen,
  className = "",
  style,
}: {
  result: SearchResult;
  have?: Item;
  onOpen: (id: string, preview?: Item) => void;
  className?: string;
  style?: CSSProperties;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = `${result.type}-${result.tmdbId}`;

  const add = (status: Status) => {
    haptic();
    const item = addItem(result, status);
    showToast(`${result.title} · added to ${STATUSES.find((s) => s.id === status)?.label}`);
    void refreshItem(item);
    setExpanded(false);
  };

  return (
    <div className={`border-b border-line/60 ${className}`} style={style}>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onOpen(id, have ? undefined : createPreview(result))}
          className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left"
          aria-label={`${result.title}, open details`}
        >
          <Poster path={result.poster} title={result.title} />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium">{result.title}</p>
            <p className="mt-1 flex items-center gap-2 text-xs text-dim">
              <TypeTag anime={result.anime} type={result.type} />
              <span>{result.year}</span>
              {have && !have.deleted ? <span className="text-accent">In library</span> : null}
            </p>
          </div>
        </button>
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Hide" : "Show"} status options for ${result.title}`}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-accent transition-all duration-200 active:bg-raised ${
            expanded ? "rotate-45 bg-accent/15" : ""
          }`}
        >
          <IconPlus className="h-5 w-5" />
        </button>
      </div>
      <div
        className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${
          expanded ? "max-h-16 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="flex gap-1.5 pb-2.5">
          {STATUSES.map((s) => (
            <button
              key={s.id}
              onClick={() => add(s.id)}
              className="h-9 flex-1 rounded-full bg-surface px-1 text-[11px] text-dim active:bg-raised"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
