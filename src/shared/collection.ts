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
  for (const id of ['bara', 'hana', 'marta', 'hlidkar', 'sanitka', 'sucho']) if (unc.includes(id)) out[id] = 1;
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
export function autoDeck(collection: Record<string, number>, size = DECK_MIN): Record<string, number> {
  const rank: Record<Rarity, number> = { legendary: 4, rare: 3, uncommon: 2, common: 1 };
  const owned = collectibleCards().filter((c) => (collection[c.id] ?? 0) > 0);
  const score = (c: CardDef) => rank[(c.rarity ?? 'common') as Rarity] * 2 - (c.cost ?? 1) * 0.6 + (c.kind === 'survivor' ? 0.8 : 0);
  const surv = owned.filter((c) => c.kind === 'survivor').sort((a, b) => score(b) - score(a));
  const ops = owned.filter((c) => c.kind === 'operation').sort((a, b) => score(b) - score(a));
  const deck: Record<string, number> = {};
  const add = (list: CardDef[], target: number) => {
    let added = 0;
    for (let pass = 0; pass < 2 && added < target; pass++) {
      for (const c of list) {
        if (added >= target) break;
        const have = deck[c.id] ?? 0;
        if (have < Math.min(maxCopies(c.id), collection[c.id] ?? 0) && have <= pass) {
          deck[c.id] = have + 1;
          added++;
        }
      }
    }
    return added;
  };
  const s = add(surv, Math.round(size * 0.65));
  add(ops, size - s);
  if (deckSize(deck) < size) add(surv, size - deckSize(deck));
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
