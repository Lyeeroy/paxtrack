"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { refreshItem } from "@/lib/refresh";
import { addItem, createPreview, removeItem } from "@/lib/store";
import { haptic, showToast } from "@/lib/toast";
import type { Item, SearchResult, Status } from "@/lib/types";
import { IconPlus, Poster, TypeTag } from "./ui";

const STATUSES: { id: Status; label: string }[] = [
  { id: "watching", label: "Watching" },
  { id: "planned", label: "Planned" },
  { id: "completed", label: "Done" },
  { id: "dropped", label: "Dropped" },
];

/** A searchable title row: the poster/name rolls out and four statuses roll in, in place. */
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
  const [confirmStatus, setConfirmStatus] = useState<Status | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = `${result.type}-${result.tmdbId}`;

  useEffect(() => () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); }, []);

  const disarm = () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = null;
    setConfirmStatus(null);
  };

  const add = (status: Status) => {
    haptic();
    const item = addItem(result, status);
    showToast(`${result.title} · added to ${STATUSES.find((s) => s.id === status)?.label}`);
    void refreshItem(item);
    setExpanded(false);
  };

  // Tapping the status you already have mirrors Detail: arm "Tap again" for 3 s,
  // then remove the title instead of re-adding it.
  const pick = (status: Status) => {
    const active = !!have && !have.deleted && have.status === status;
    if (active && confirmStatus !== status) {
      haptic();
      setConfirmStatus(status);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => {
        confirmTimer.current = null;
        setConfirmStatus(null);
      }, 3000);
      return;
    }
    if (active) {
      haptic(8);
      removeItem(id);
      showToast(`${result.title} removed`);
      disarm();
      setExpanded(false);
      return;
    }
    disarm();
    add(status);
  };

  const front: CSSProperties = {
    transform: expanded ? "translateX(-20px) rotateY(-18deg)" : "translateX(0) rotateY(0deg)",
    opacity: expanded ? 0 : 1,
  };
  const back: CSSProperties = {
    transform: expanded ? "translateX(0) rotateY(0deg)" : "translateX(20px) rotateY(18deg)",
    opacity: expanded ? 1 : 0,
  };

  return (
    <div className={`border-b border-line/60 ${className}`} style={style}>
      <div className="flex items-center gap-3 py-2.5">
        <div className="relative h-16 min-w-0 flex-1" style={{ perspective: 600 }}>
          <div
            aria-hidden={expanded}
            className={`absolute inset-0 flex items-center gap-3 transition-[transform,opacity] duration-200 ease-out ${expanded ? "pointer-events-none" : ""}`}
            style={front}
          >
            <button
              onClick={() => onOpen(id, have ? undefined : createPreview(result))}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
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
          </div>
          <div
            aria-hidden={!expanded}
            className={`absolute inset-0 flex items-center gap-1.5 transition-[transform,opacity] duration-200 ease-out ${
              expanded ? "" : "pointer-events-none"
            }`}
            style={back}
          >
            {STATUSES.map((s) => {
              const armed = confirmStatus === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => pick(s.id)}
                  tabIndex={expanded ? 0 : -1}
                  aria-label={armed ? `Tap again to remove ${result.title}` : undefined}
                  className={`h-9 flex-1 rounded-full px-1 text-[11px] active:opacity-80 ${
                    armed
                      ? "bg-danger/15 text-danger"
                      : have && !have.deleted && have.status === s.id
                        ? "bg-accent/15 text-accent"
                        : "bg-surface text-dim active:bg-raised"
                  }`}
                >
                  {armed ? "Tap again" : s.label}
                </button>
              );
            })}
          </div>
        </div>
        <button
          onClick={() => {
            if (expanded) disarm();
            setExpanded(!expanded);
          }}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Hide" : "Show"} status options for ${result.title}`}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-accent transition-all duration-200 active:bg-raised ${
            expanded ? "rotate-45 bg-accent/15" : ""
          }`}
        >
          <IconPlus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
