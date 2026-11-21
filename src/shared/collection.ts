// Collectible layer: rarities, boosters, starter set, deck rules.
// Pure functions shared by server (authoritative) and client (UI, validation hints).

import { CARDS, OPERATIONS, SURVIVORS, type CardDef } from '../engine/cards';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Běžná',
  uncommon: 'Neobvyklá',
  rare: 'Vzácná',
  legendary: 'Legendární',
};

/** Kapky you get when a card would exceed the max useful copies. */
export const DUST_VALUE: Record<Rarity, number> = { common: 5, uncommon: 15, rare: 40, legendary: 120 };

export const BOOSTER_PRICE = 100;
export const BOOSTER_SIZE = 5;
export const DECK_MIN = 30;
export const DECK_MAX = 40;
export const WELCOME_BOOSTERS = 3;
export const REWARD = { win: 100, loss: 50, draw: 60, minTurns: 6 };

export function rarityOf(id: string): Rarity {
  return (CARDS[id]?.rarity as Rarity) ?? 'common';
}

export function maxCopies(id: string): number {
  return rarityOf(id) === 'legendary' ? 1 : 2;
}

/** All cards that can appear in boosters / decks. */
export function collectibleCards(): CardDef[] {
  return [...SURVIVORS, ...OPERATIONS].filter((c) => c.collectible !== false);
}

export function byRarity(r: Rarity): CardDef[] {
  return collectibleCards().filter((c) => (c.rarity ?? 'common') === r);
}

/** Starter set every new account receives (all commons ×2 + a few uncommons). */
export function starterSet(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of byRarity('common')) out[c.id] = 2;
  const unc = byRarity('uncommon').map((c) => c.id);
  // a fixed, friendly selection of uncommons so the starter deck is coherent
  // tested in round-2 sims: enough base damage that starter games are decided by fighting, not by Žízeň
  const picks: Record<string, number> = { bara: 2, hana: 1, vymahac: 1, podkop: 2, delostrelectvo: 1, sanitka: 1 };
  for (const [id, n] of Object.entries(picks)) if (unc.includes(id)) out[id] = n;
  return out;
}

export type Rng = () => number;

export interface PulledCard {
  id: string;
  rarity: Rarity;
  /** true if the player did not own any copy before this pack */
  isNew: boolean;
  /** if > 0, the card exceeded max copies and was converted to kapky */
  dust: number;
}

function pickWeighted<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

/**
 * Open one booster: 3 commons, 1 uncommon (15 % upgraded to rare), 1 rare slot (25 % legendary).
 * Duplicate protection: prefers cards the player does not own at max copies yet.
 * Mutates `collection` and returns the pulled cards.
 */
const ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'legendary'];

/** Upgrade protection: if every card of a rarity is already maxed, the slot moves up a rarity. */
function resolveSlot(r: Rarity, collection: Record<string, number>): Rarity {
  let i = ORDER.indexOf(r);
  while (i < ORDER.length - 1) {
    const pool = byRarity(ORDER[i]);
    if (pool.length && pool.some((c) => (collection[c.id] ?? 0) < maxCopies(c.id))) break;
    i++;
  }
  if (byRarity(ORDER[i]).length) return ORDER[i];
  for (let j = ORDER.indexOf(r); j >= 0; j--) if (byRarity(ORDER[j]).length) return ORDER[j];
  return 'common';
}

export function openBooster(collection: Record<string, number>, rng: Rng): PulledCard[] {
  const raw: Rarity[] = ['common', 'common', 'common', rng() < 0.15 ? 'rare' : 'uncommon', rng() < 0.25 ? 'legendary' : 'rare'];
  const out: PulledCard[] = [];
  for (const slot of raw) {
    const up = resolveSlot(slot, collection);
    const upPool = byRarity(up);
    const allMaxed = !upPool.some((c) => (collection[c.id] ?? 0) < maxCopies(c.id));
    // fully collected: keep the original slot rarity so duplicates turn into the slot's dust value
    const r = allMaxed ? slot : up;
    const pool = byRarity(r).length ? byRarity(r) : upPool;
    const notMaxed = pool.filter((c) => (collection[c.id] ?? 0) < maxCopies(c.id));
    const c = pickWeighted(notMaxed.length ? notMaxed : pool, rng);
    const had = collection[c.id] ?? 0;
    if (had >= maxCopies(c.id)) {
      out.push({ id: c.id, rarity: r, isNew: false, dust: DUST_VALUE[r] });
    } else {
      collection[c.id] = had + 1;
      out.push({ id: c.id, rarity: r, isNew: had === 0, dust: 0 });
    }
  }
  // reveal order: commons first, best card last (classic pack-opening drama)
  const rank: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, legendary: 3 };
  return out.sort((a, b) => rank[a.rarity] - rank[b.rarity]);
}

export interface DeckDef {
  id: string;
  name: string;
  cards: Record<string, number>;
}

export function deckSize(cards: Record<string, number>): number {
  return Object.values(cards).reduce((s, n) => s + n, 0);
}

/** Returns a list of problems (empty = valid). */
export function validateDeck(cards: Record<string, number>, collection: Record<string, number>): string[] {
  const errs: string[] = [];
  const n = deckSize(cards);
  if (n < DECK_MIN) errs.push(`Balíček má ${n} karet – potřebuješ aspoň ${DECK_MIN}.`);
  if (n > DECK_MAX) errs.push(`Balíček má ${n} karet – maximum je ${DECK_MAX}.`);
  for (const [id, cnt] of Object.entries(cards)) {
    const def = CARDS[id];
    if (!def || (def.kind !== 'survivor' && def.kind !== 'operation') || def.collectible === false) { errs.push(`Neznámá karta: ${id}`); continue; }
    if (!Number.isInteger(cnt) || cnt < 0) errs.push(`Neplatný počet u ${def.name}.`);
    if (cnt > maxCopies(id)) errs.push(`${def.name}: max. ${maxCopies(id)}×.`);
    if (cnt > (collection[id] ?? 0)) errs.push(`${def.name}: máš jen ${collection[id] ?? 0}×.`);
  }
  return errs;
}

/** Deck list (ids, with repeats) for the engine. */
export function deckToList(cards: Record<string, number>): string[] {
  const out: string[] = [];
  for (const [id, n] of Object.entries(cards)) for (let i = 0; i < n; i++) out.push(id);
  return out;
}

/**
 * Build a reasonable deck from a collection: best rarity first, then a healthy
 * mix of survivors (~65 %) and operations, cheap cards favoured.
 */
// Hand-tuned card strength for the auto deck builder (from round-2 bot A/B games).
const POWER: Record<string, number> = {
  poslednikapka: 9, podkop: 8, prorok: 8, delostrelectvo: 7.5, kyselydest: 7.5, bara: 7, granatnik: 7, velitelka: 7,
  prak: 6, hana: 6, minometcik: 6, honak: 6, baron: 6, doktorka: 6, kat: 5.5, rez: 5.5, sanitka: 5.5, lasar: 5,
  pumpar: 5, sucho: 5, boure: 5, vysadek: 5, oaza: 5, felcar: 4.5, paserak: 4.5, marta: 4.5, ludmila: 4.5,
  prospektorka: 4.5, jiskra: 4.5, myska: 4.5, karavana: 4.5, pramen: 4.5, vymahac: 4.5, hlidkar: 4.5, bedrich: 4.5,
  rex: 4.5, strazce: 4.5, matka: 4.5, sabotaz: 4.5, prepad: 4.5, vymena: 4, radista: 4, bubenik: 4, naborar: 4, zved: 4, evakuace: 4,
};
const DAMAGE = new Set(['poslednikapka', 'podkop', 'delostrelectvo', 'kyselydest', 'bara', 'granatnik', 'prak', 'hana', 'minometcik', 'honak', 'velitelka']);
const REPAIR = new Set(['rez', 'doktorka', 'sanitka']);
const DRAW = new Set(['pumpar', 'paserak', 'marta', 'ludmila', 'prospektorka', 'jiskra', 'myska', 'karavana', 'pramen', 'vymena']);

/**
 * Builds a legal deck of `size` cards by role: enough base damage, a little repair, capped pure card draw.
 * Cards already in `base` are kept and only the rest is filled in.
 */
export function autoDeck(collection: Record<string, number>, size = DECK_MIN, base: Record<string, number> = {}): Record<string, number> {
  const rank: Record<Rarity, number> = { legendary: 4, rare: 3, uncommon: 2, common: 1 };
  const deck: Record<string, number> = {};
  const legal = new Set(collectibleCards().map((c) => c.id));
  for (const [id, n] of Object.entries(base)) {
    if (!legal.has(id)) continue;
    const keep = Math.min(Math.floor(n), maxCopies(id), collection[id] ?? 0);
    if (keep > 0) deck[id] = keep;
  }
  if (deckSize(deck) >= size) return deck;
  const limit = (id: string) => Math.min(maxCopies(id), collection[id] ?? 0);
  const copies: { c: CardDef; v: number }[] = [];
  for (const c of collectibleCards()) {
    for (let k = 0; k < limit(c.id); k++) copies.push({ c, v: (POWER[c.id] ?? 4) + 0.3 * rank[(c.rarity ?? 'common') as Rarity] - k * 0.6 });
  }
  copies.sort((a, b) => b.v - a.v);
  const count = (pred: (c: CardDef) => boolean) => Object.entries(deck).reduce((s, [id, n]) => s + (CARDS[id] && pred(CARDS[id]) ? n : 0), 0);
  const fill = (ok: (c: CardDef) => boolean, cap = Infinity, capPred: (c: CardDef) => boolean = ok) => {
    for (const { c } of copies) {
      if (deckSize(deck) >= size) return;
      if (!ok(c) || (deck[c.id] ?? 0) >= limit(c.id)) continue;
      if (capPred(c) && count(capPred) >= cap) continue;
      deck[c.id] = (deck[c.id] ?? 0) + 1;
    }
  };
  fill((c) => DAMAGE.has(c.id), 8);
  fill((c) => REPAIR.has(c.id), 3);
  const survCap = Math.ceil(size * 0.7);
  fill((c) => !DRAW.has(c.id) || count((x) => DRAW.has(x.id)) < 6, survCap, (c) => c.kind === 'survivor');
  fill(() => true); // small collections: take whatever is left
  return deck;
}

export interface PublicProfile {
  name: string;
  kapky: number;
  unopened: number;
  collection: Record<string, number>;
  decks: DeckDef[];
  stats: { wins: number; losses: number; draws: number; boostersOpened: number };
  created: number;
}
