// Player accounts, collections, boosters and decks (JSON file store).

import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  autoDeck, BOOSTER_PRICE, type DeckDef, deckSize, openBooster, type PublicProfile, type PulledCard, REWARD,
  starterSet, validateDeck, WELCOME_BOOSTERS,
} from '../shared/collection';

interface UserRec {
  name: string;
  salt: string;
  hash: string;
  created: number;
  kapky: number;
  unopened: number;
  collection: Record<string, number>;
  decks: DeckDef[];
  stats: PublicProfile['stats'];
}

interface Store {
  v: 1;
  users: Record<string, UserRec>;
  sessions: Record<string, string>; // token -> user key
}

const NAME_RE = /^[\p{L}\p{N} _.-]{3,20}$/u;

function key(name: string) {
  return name.trim().toLowerCase();
}

function hashPw(pw: string, salt: string) {
  return scryptSync(pw, salt, 32).toString('hex');
}

const rng = () => randomInt(0, 2 ** 31) / 2 ** 31;

export class Accounts {
  private store: Store = { v: 1, users: {}, sessions: {} };
  private dirty = false;

  constructor(private file: string | null = null) {
    if (file && existsSync(file)) {
      try {
        this.loads(readFileSync(file, 'utf8'));
      } catch (e) {
        console.warn('Nelze načíst účty:', e);
      }
    }
  }

  /** Replace the store from serialized JSON. */
  loads(json: string) {
    const s = JSON.parse(json) as Store;
    s.sessions ??= {};
    s.users ??= {};
    this.store = s;
    this.dirty = false;
  }

  /** Serialized store, or null when nothing changed (unless forced). Marks clean. */
  dumps(force = false): string | null {
    if (!this.dirty && !force) return null;
    this.dirty = false;
    return JSON.stringify(this.store);
  }

  save(force = false) {
    if (!this.file) return;
    if (!this.dirty && !force) return;
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(`${this.file}.tmp`, JSON.stringify(this.store));
    renameSync(`${this.file}.tmp`, this.file);
    this.dirty = false;
  }

  private touch() { this.dirty = true; }

  profile(u: UserRec): PublicProfile {
    return { name: u.name, kapky: u.kapky, unopened: u.unopened, collection: u.collection, decks: u.decks, stats: u.stats, created: u.created };
  }

  private newSession(k: string): string {
    const token = randomBytes(24).toString('hex');
    this.store.sessions[token] = k;
    this.touch();
    return token;
  }

  register(name: string, password: string): { token: string; profile: PublicProfile } | { error: string } {
    const n = String(name ?? '').replace(/\s+/g, ' ').trim();
    if (!NAME_RE.test(n)) return { error: 'Jméno musí mít 3–20 znaků (písmena, čísla, mezera, _ . -).' };
    if (typeof password !== 'string' || password.length < 4 || password.length > 100) return { error: 'Heslo musí mít aspoň 4 znaky.' };
    const k = key(n);
    if (Object.prototype.hasOwnProperty.call(this.store.users, k)) return { error: 'Toto jméno už někdo používá.' };
    const salt = randomBytes(16).toString('hex');
    const collection = starterSet();
    const u: UserRec = {
      name: n, salt, hash: hashPw(password, salt), created: Date.now(), kapky: 0, unopened: WELCOME_BOOSTERS,
      collection, decks: [], stats: { wins: 0, losses: 0, draws: 0, boostersOpened: 0 },
    };
    u.decks.push({ id: 'starter', name: 'Startovní balíček', cards: autoDeck(collection) });
    this.store.users[k] = u;
    this.touch();
    return { token: this.newSession(k), profile: this.profile(u) };
  }

  login(name: string, password: string): { token: string; profile: PublicProfile } | { error: string } {
    const k = key(String(name ?? '').replace(/\s+/g, ' '));
    const u = Object.prototype.hasOwnProperty.call(this.store.users, k) ? this.store.users[k] : undefined;
    if (!u || typeof password !== 'string') return { error: 'Špatné jméno nebo heslo.' };
    const a = Buffer.from(hashPw(password, u.salt), 'hex');
    const b = Buffer.from(u.hash, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { error: 'Špatné jméno nebo heslo.' };
    return { token: this.newSession(key(u.name)), profile: this.profile(u) };
  }

  logout(token: string) {
    delete this.store.sessions[token];
    this.touch();
  }

  userByToken(token: string | undefined | null): UserRec | null {
    if (!token) return null;
    if (!Object.prototype.hasOwnProperty.call(this.store.sessions, token)) return null;
    const k = this.store.sessions[token];
    return Object.prototype.hasOwnProperty.call(this.store.users, k) ? this.store.users[k] : null;
  }

  openBooster(u: UserRec): { cards: PulledCard[]; profile: PublicProfile } | { error: string } {
    if (u.unopened <= 0) return { error: 'Nemáš žádný neotevřený booster.' };
    u.unopened--;
    const cards = openBooster(u.collection, rng);
    u.kapky += cards.reduce((s, c) => s + c.dust, 0);
    u.stats.boostersOpened++;
    this.touch();
    return { cards, profile: this.profile(u) };
  }

  buyBooster(u: UserRec): { profile: PublicProfile } | { error: string } {
    if (u.kapky < BOOSTER_PRICE) return { error: `Booster stojí ${BOOSTER_PRICE} kapek.` };
    u.kapky -= BOOSTER_PRICE;
    u.unopened++;
    this.touch();
    return { profile: this.profile(u) };
  }

  saveDeck(u: UserRec, deck: { id?: string; name?: string; cards?: Record<string, number> }): { profile: PublicProfile; deckId: string } | { error: string } {
    const cards: Record<string, number> = {};
    for (const [id, n] of Object.entries(deck.cards ?? {})) if (Number(n) > 0) cards[id] = Math.floor(Number(n));
    const errs = validateDeck(cards, u.collection);
    // allow saving incomplete decks (work in progress) but not illegal copies
    const hard = errs.filter((e) => !e.startsWith('Balíček má'));
    if (hard.length) return { error: hard[0] };
    const name = String(deck.name ?? 'Balíček').trim().slice(0, 30) || 'Balíček';
    let d = deck.id ? u.decks.find((x) => x.id === deck.id) : undefined;
    if (!d) {
      if (u.decks.length >= 12) return { error: 'Maximálně 12 balíčků.' };
      d = { id: randomBytes(6).toString('hex'), name, cards };
      u.decks.push(d);
    } else {
      d.name = name;
      d.cards = cards;
    }
    this.touch();
    return { profile: this.profile(u), deckId: d.id };
  }

  deleteDeck(u: UserRec, id: string): { profile: PublicProfile } {
    u.decks = u.decks.filter((d) => d.id !== id);
    this.touch();
    return { profile: this.profile(u) };
  }

  /** Returns a playable deck list or an error. */
  deckFor(u: UserRec, deckId: string | undefined): { cards: Record<string, number> } | { error: string } {
    const d = deckId ? u.decks.find((x) => x.id === deckId) : u.decks[0];
    if (!d) return { error: deckId ? 'Vybraný balíček nebyl nalezen – vyber jiný v Kolekci a balíčcích.' : 'Nemáš žádný balíček.' };
    const errs = validateDeck(d.cards, u.collection);
    if (errs.length) return { error: `Balíček „${d.name}“ není platný: ${errs[0]}` };
    return { cards: d.cards };
  }

  /** Award kapky after an online game. */
  reward(name: string, result: 'win' | 'loss' | 'draw', turns: number): number {
    const u = this.get(name);
    if (!u) return 0;
    if (result === 'win') u.stats.wins++;
    else if (result === 'loss') u.stats.losses++;
    else u.stats.draws++;
    const gain = turns >= REWARD.minTurns ? REWARD[result] : 0;
    u.kapky += gain;
    this.touch();
    return gain;
  }

  get(name: string): UserRec | null {
    const k = key(name);
    return Object.prototype.hasOwnProperty.call(this.store.users, k) ? this.store.users[k] : null;
  }

  static deckSize = deckSize;
}
