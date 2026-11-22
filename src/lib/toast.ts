import { useSyncExternalStore } from "react";

export interface Toast {
  id: number;
  msg: string;
  undo?: () => void;
}

let current: Toast | null = null;
let n = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function set(t: Toast | null) {
  current = t;
  listeners.forEach((l) => l());
}

export function showToast(msg: string, undo?: () => void) {
  clearTimeout(timer);
  set({ id: ++n, msg, undo });
  timer = setTimeout(() => set(null), 4000);
}

export function dismissToast() {
  clearTimeout(timer);
  set(null);
}

export function useToast(): Toast | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => null,
  );
}

export function haptic(ms = 10) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}
