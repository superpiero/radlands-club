// Client-side account state (session token + profile) and API helpers.
import { useSyncExternalStore } from 'react';
import type { PublicProfile, PulledCard } from '../shared/collection';

const KEY = 'pk.session';
const DECK_KEY = 'pk.deck';

function lsGet(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k: string, v: string | null) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* ignore */ } }

interface AccState { session: string | null; profile: PublicProfile | null; loading: boolean; offline: boolean }

let state: AccState = { session: lsGet(KEY), profile: null, loading: false, offline: false };
const subs = new Set<() => void>();
function set(p: Partial<AccState>) { state = { ...state, ...p }; for (const s of subs) s(); }

export const account = {
  get: () => state,
  subscribe(fn: () => void) { subs.add(fn); return () => { subs.delete(fn); }; },
  session: () => state.session,
};

export function useAccount(): AccState {
  return useSyncExternalStore(account.subscribe, account.get, account.get);
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...(state.session ? { authorization: `Bearer ${state.session}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* ignore */ }
  if (!res.ok || (data && data.error)) {
    if (res.status === 401) { lsSet(KEY, null); set({ session: null, profile: null }); }
    throw new Error(data?.error ?? (res.status === 404 ? 'Server nepodporuje účty (hraješ offline?).' : `Chyba ${res.status}`));
  }
  return data as T;
}

export async function refreshProfile(): Promise<void> {
  if (!state.session) return;
  set({ loading: true });
  try {
    const r = await api<{ profile: PublicProfile }>('/api/me');
    set({ profile: r.profile, loading: false, offline: false });
  } catch (e) {
    set({ loading: false, offline: !(e instanceof Error && /přihlášen/.test(e.message)) });
  }
}

export async function register(name: string, password: string) {
  const r = await api<{ token: string; profile: PublicProfile }>('/api/register', { name, password });
  lsSet(KEY, r.token);
  set({ session: r.token, profile: r.profile });
  return r.profile;
}

export async function login(name: string, password: string) {
  const r = await api<{ token: string; profile: PublicProfile }>('/api/login', { name, password });
  lsSet(KEY, r.token);
  set({ session: r.token, profile: r.profile });
  return r.profile;
}

export async function logout() {
  try { await api('/api/logout', {}); } catch { /* ignore */ }
  lsSet(KEY, null);
  set({ session: null, profile: null });
}

export async function openBoosterApi(): Promise<PulledCard[]> {
  const r = await api<{ cards: PulledCard[]; profile: PublicProfile }>('/api/booster/open', {});
  // profile is applied by caller after the reveal animation (so counters don't spoil it)
  pendingProfile = r.profile;
  return r.cards;
}
let pendingProfile: PublicProfile | null = null;
export function applyPendingProfile() {
  if (pendingProfile) { set({ profile: pendingProfile }); pendingProfile = null; }
}

export async function buyBooster() {
  const r = await api<{ profile: PublicProfile }>('/api/booster/buy', {});
  set({ profile: r.profile });
}

export async function saveDeck(deck: { id?: string; name: string; cards: Record<string, number> }) {
  const r = await api<{ profile: PublicProfile; deckId: string }>('/api/deck/save', deck);
  set({ profile: r.profile });
  return r.deckId;
}

export async function deleteDeck(id: string) {
  const r = await api<{ profile: PublicProfile }>('/api/deck/delete', { id });
  set({ profile: r.profile });
}

export function selectedDeck(): string | null { return lsGet(DECK_KEY); }
export function selectDeck(id: string) { lsSet(DECK_KEY, id); }

if (state.session) void refreshProfile();
