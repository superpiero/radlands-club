// Tiny global store for the "inspect card" panel (hovered card).
import { useSyncExternalStore } from 'react';

export interface ZoomTarget { id: string; uid?: string }

let current: ZoomTarget | null = null;
let pinned: ZoomTarget | null = null;
const subs = new Set<() => void>();
let clearTimer: ReturnType<typeof setTimeout> | null = null;

function emit() { for (const s of subs) s(); }

export const zoomStore = {
  set(t: ZoomTarget) {
    if (clearTimer) { clearTimeout(clearTimer); clearTimer = null; }
    current = t;
    emit();
  },
  clear(id?: string) {
    if (clearTimer) clearTimeout(clearTimer);
    clearTimer = setTimeout(() => {
      if (!id || current?.id === id) { current = null; emit(); }
    }, 250);
  },
  pin(t: ZoomTarget | null) { pinned = t; emit(); },
  get(): ZoomTarget | null { return current ?? pinned; },
  subscribe(fn: () => void) { subs.add(fn); return () => { subs.delete(fn); }; },
};

export function useZoom() {
  return zoomStore;
}

export function useZoomTarget(): ZoomTarget | null {
  return useSyncExternalStore(zoomStore.subscribe, zoomStore.get, zoomStore.get);
}
