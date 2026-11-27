"use client";

import { useEffect, useLayoutEffect, useRef, type ComponentProps, type ReactElement } from "react";

type NavIcon = (props: { className?: string }) => ReactElement;

export interface NavEntry<T extends string> {
  id: T;
  label: string;
  Icon: NavIcon;
}

// useLayoutEffect in the browser (no first-paint flash), no-op warning on the server.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * The app's one sliding-pill capsule. Used by the main tab bar and by the
 * expanded info drawer's section menu so both look and behave identically.
 */
export default function NavCapsule<T extends string>({
  items,
  value,
  onNavigate,
  label,
  variant = "page",
  idPrefix,
  className = "",
  ...navProps
}: {
  items: readonly NavEntry<T>[];
  value: T;
  onNavigate: (id: T) => void;
  label: string;
  variant?: "page" | "tab";
  /** When set, buttons get `${idPrefix}-${id}` ids for tabpanel labelling. */
  idPrefix?: string;
} & Omit<ComponentProps<"nav">, "children">) {
  const list = useRef<HTMLUListElement | null>(null);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const pill = useRef<HTMLSpanElement | null>(null);
  const placed = useRef(false);
  const index = Math.max(0, items.findIndex((entry) => entry.id === value));

  useIsoLayoutEffect(() => {
    const ul = list.current;
    const highlight = pill.current;
    const button = buttons.current[index];
    if (!ul || !highlight || !button) return;

    const place = () => {
      if (!placed.current) highlight.style.transition = "none";
      highlight.style.transform = `translateX(${button.offsetLeft}px)`;
      highlight.style.width = `${button.offsetWidth}px`;
      if (!placed.current) {
        void highlight.offsetWidth; // commit the start position before enabling motion
        highlight.style.transition = "";
        placed.current = true;
      }
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(ul);
    return () => observer.disconnect();
  }, [index, items.length]);

  return (
    <nav aria-label={label} className={className} {...navProps}>
      <ul
        ref={list}
        role={variant === "tab" ? "tablist" : undefined}
        className="pointer-events-auto relative flex w-full items-center gap-0.5 rounded-full border border-line bg-raised/80 p-1.5 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl sm:w-auto"
      >
        <span
          ref={pill}
          aria-hidden
          className="pointer-events-none absolute inset-y-1.5 left-0 w-0 rounded-full bg-accent/15 transition-[transform,width] duration-200 ease-out"
        />
        {items.map(({ id, label: name, Icon }, i) => {
          const active = value === id;
          return (
            <li key={id} className="min-w-0 flex-1 sm:flex-none">
              <button
                ref={(node) => { buttons.current[i] = node; }}
                type="button"
                id={idPrefix ? `${idPrefix}-${id}` : undefined}
                onClick={() => onNavigate(id)}
                role={variant === "tab" ? "tab" : undefined}
                aria-selected={variant === "tab" ? active : undefined}
                aria-current={variant === "page" && active ? "page" : undefined}
                aria-label={name}
                className={`relative z-10 flex h-11 w-full items-center justify-center rounded-full px-2 transition-[color,transform] duration-200 active:scale-95 sm:w-[72px] ${
                  active ? "text-accent" : "text-faint hover:text-dim"
                }`}
              >
                <Icon className="h-[21px] w-[21px] shrink-0" />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
