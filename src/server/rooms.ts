// Room management: seats, reconnection, broadcasting per-player views.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { WebSocket } from 'ws';
import { Game } from '../engine/game';
import type { Action, PlayerIdx } from '../engine/types';
import { buildView } from '../engine/view';
import { isEmote, type ChatLine, type RoomInfo, type RoomOptions, type ServerMsg } from '../shared/protocol';
import { deckToList } from '../shared/collection';
import type { Accounts } from './accounts';

export interface Client {
  ws: WebSocket;
  token: string;
  name: string;
  /** Registered account name (null = guest). */
  account?: string | null;
  room: Room | null;
  lastMsgs: number[];
}

interface Seat {
  token: string;
  name: string;
  client: Client | null;
  user?: string | null;
  deck?: Record<string, number> | null;
  /** ms timestamp when the seat's client disconnected (null = connected). */
  awaySince?: number | null;
}

export const AUTO_ANSWER_MS = 45_000;
export const CLAIM_WIN_MS = 120_000;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class Room {
  code: string;
  options: RoomOptions;
  seats: [Seat | null, Seat | null] = [null, null];
  spectators = new Set<Client>();
  game: Game | null = null;
  history: { p: PlayerIdx; a: Action }[] = [];
  seed = 0;
  names: [string, string] = ['', ''];
  dirty = true;
  chat: ChatLine[] = [];
  rematch: [boolean, boolean] = [false, false];
  score: [number, number] = [0, 0];
  gameNo = 0;
  lastActivity = Date.now();

  accounts: Accounts | null = null;
  gameDecks: [string[], string[]] | null = null;

  constructor(code: string, options: RoomOptions) {
    this.code = code;
    this.options = options;
  }

  get collection(): boolean {
    return this.options.deckMode === 'collection';
  }

  status(): RoomInfo['status'] {
    if (!this.game) return 'waiting';
    return this.game.state.phase === 'over' ? 'over' : 'playing';
  }

  seatOf(c: Client): PlayerIdx | null {
    if (this.seats[0]?.token === c.token) return 0;
    if (this.seats[1]?.token === c.token) return 1;
    return null;
  }

  info(forClient: Client): RoomInfo {
    return {
      code: this.code,
      seats: this.seats.map((s) => (s ? { name: s.name, connected: !!s.client, account: !!s.user, awayMs: s.client ? 0 : Date.now() - (s.awaySince ?? Date.now()) } : null)) as RoomInfo['seats'],
      claimWinMs: CLAIM_WIN_MS,
      turnLeftMs: this.turnLeft(Date.now()),
      you: this.seatOf(forClient),
      spectators: this.spectators.size,
      status: this.status(),
      options: this.options,
      rematch: this.rematch,
      score: this.score,
      gameNo: this.gameNo,
    };
  }

  allClients(): Client[] {
    const out: Client[] = [];
    for (const s of this.seats) if (s?.client) out.push(s.client);
    for (const c of this.spectators) out.push(c);
    return out;
  }

  broadcastRoom() {
    for (const c of this.allClients()) send(c, { t: 'room', room: this.info(c) });
  }

  broadcastState() {
    if (!this.game) return;
    for (const c of this.allClients()) {
      const seat = this.seatOf(c);
      send(c, { t: 'state', view: buildView(this.game, seat) });
    }
  }

  sendState(c: Client) {
    if (!this.game) return;
    send(c, { t: 'state', view: buildView(this.game, this.seatOf(c)) });
  }

  systemChat(text: string) {
    this.pushChat({ from: 'Systém', seat: null, text, ts: Date.now(), system: true });
  }

  pushChat(line: ChatLine) {
    this.chat.push(line);
    if (this.chat.length > 100) this.chat.shift();
    for (const c of this.allClients()) send(c, { t: 'chat', line });
  }

  /** Add a client; returns error message or null. */
  join(c: Client, spectate = false, deckId?: string): string | null {
    this.lastActivity = Date.now();
    // Reconnect to an existing seat
    for (const i of [0, 1] as PlayerIdx[]) {
      const s = this.seats[i];
      if (s && s.token === c.token) {
        if (s.client && s.client !== c) {
          send(s.client, { t: 'error', msg: 'Připojil(a) ses z jiného okna – toto okno bylo odpojeno.' });
          s.client.room = null;
        }
        s.client = c;
        s.awaySince = null;
        s.name = c.name;
        c.room = this;
        this.systemChat(`${c.name} je zpět ve hře.`);
        this.afterJoin(c);
        return null;
      }
    }
    if (!spectate) {
      const free = this.seats.findIndex((s) => s === null);
      if (free >= 0) {
        let deck: Record<string, number> | null = null;
        if (this.collection) {
          const user = c.account && this.accounts ? this.accounts.get(c.account) : null;
          if (!user) return 'Sběratelský stůl: nejdřív se přihlas (nahoře na úvodní stránce) – nebo se připoj jako divák.';
          const d = this.accounts!.deckFor(user, deckId);
          if ('error' in d) return d.error;
          deck = d.cards;
        }
        this.seats[free] = { token: c.token, name: c.name, client: c, user: c.account ?? null, deck };
        c.room = this;
        this.systemChat(`${c.name} si sedá ke stolu.`);
        if (this.seats[0] && this.seats[1] && !this.game) this.startGame();
        this.afterJoin(c);
        return null;
      }
    }
    this.spectators.add(c);
    c.room = this;
    this.systemChat(`${c.name} sleduje hru.`);
    this.afterJoin(c);
    return null;
  }

  private afterJoin(c: Client) {
    send(c, { t: 'chatHistory', lines: this.chat });
    this.broadcastRoom();
    if (this.game) this.broadcastState();
  }

  leave(c: Client, hard: boolean) {
    this.spectators.delete(c);
    for (const i of [0, 1] as PlayerIdx[]) {
      const s = this.seats[i];
      if (s && s.client === c) {
        s.client = null;
        s.awaySince = Date.now();
        if (hard && !this.game) {
          this.seats[i] = null;
          this.systemChat(`${c.name} odešel(a) od stolu.`);
        } else {
          this.systemChat(`${c.name} se odpojil(a). Místo zůstává rezervované – stačí znovu otevřít odkaz.`);
        }
      }
    }
    c.room = null;
    this.broadcastRoom();
  }

  startGame() {
    const names: [string, string] = [this.seats[0]!.name, this.seats[1]!.name];
    this.names = names;
    this.dirty = true;
    this.seed = Math.floor(Math.random() * 2 ** 31);
    this.gameDecks = this.collection ? [deckToList(this.seats[0]!.deck ?? {}), deckToList(this.seats[1]!.deck ?? {})] : null;
    this.game = Game.create({ names, seed: this.seed, baseMode: this.options.baseMode, decks: this.gameDecks ?? undefined });
    this.history = [];
    this.rematch = [false, false];
    this.gameNo++;
    this.systemChat(this.gameNo > 1 ? `Odveta! Hra č. ${this.gameNo} začíná.` : 'Hra začíná! Vyberte si základny.');
    this.broadcastRoom();
    this.broadcastState();
  }

  act(c: Client, action: Action, asSeat?: PlayerIdx) {
    this.lastActivity = Date.now();
    const seat = asSeat ?? this.seatOf(c);
    if (seat === null || !this.game) return send(c, { t: 'error', msg: 'Nejsi hráč u tohoto stolu.' });
    const before = this.game.state.phase;
    if (!this.game.state.pending) this.boundary = this.history.length;
    const res = this.game.act(seat, action);
    if (!res.ok) {
      // the engine rolled the whole action back: drop its partial replay log too
      if (res.rolledBack) { this.history.length = Math.min(this.history.length, this.boundary); this.dirty = true; this.broadcastState(); }
      return send(c, { t: 'error', msg: res.error });
    }
    this.history.push({ p: seat, a: action });
    this.dirty = true;
    this.broadcastState();
    if (before !== 'over' && this.game.state.phase === 'over') {
      const w = this.game.state.winner;
      if (w === 0 || w === 1) this.score[w]++;
      this.giveRewards();
      this.broadcastRoom();
    }
  }

  /** Periodic housekeeping: auto-answer for absent players, room info refresh. */
  private lastAwayBroadcast = 0;
  /** history index where the current top-level action started */
  private boundary = 0;
  private timerKey = '';
  private timerStart = 0;

  /** Remaining ms for the current timed decision (active turn or pending prompt). */
  private promptKey = '';
  private promptStart = 0;

  /** Remaining ms of the current decision: the active player's turn clock, or the opponent's reaction clock. */
  turnLeft(now: number): number | null {
    const secs = this.options.turnSeconds ?? 0;
    if (!secs || !this.game || this.game.state.phase !== 'play') return null;
    this.syncTimer(now);
    const st = this.game.state;
    if (st.pending && st.pending.player !== st.active) return Math.max(0, Math.min(secs, 45) * 1000 - (now - this.promptStart));
    return Math.max(0, secs * 1000 - (now - this.timerStart));
  }

  private syncTimer(now: number) {
    const st = this.game!.state;
    let changed = false;
    const turnKey = `t${st.turn}:${st.active}`;
    if (turnKey !== this.timerKey) {
      this.timerKey = turnKey;
      this.timerStart = now;
      changed = true;
    }
    // the opponent's reaction prompt pauses the active player's clock
    const pk = st.pending && st.pending.player !== st.active ? `p${st.pending.id}` : '';
    if (pk !== this.promptKey) {
      if (this.promptKey && !pk) this.timerStart += now - this.promptStart;
      if (pk) this.promptStart = now;
      this.promptKey = pk;
      changed = true;
    }
    return changed;
  }

  tick(now: number) {
    if (!this.game || this.game.state.phase === 'over') return;
    const st = this.game.state;
    const awayLong = (i: PlayerIdx) => {
      const s = this.seats[i];
      return !!s && !s.client && !!s.awaySince && now - s.awaySince >= AUTO_ANSWER_MS;
    };
    // setup phases: decide for an absent player so the table never gets stuck
    if (st.phase === 'draft') {
      for (const i of [0, 1] as PlayerIdx[]) {
        if (!st.players[i].draftPicked && awayLong(i)) {
          const a: Action = { t: 'draftPick', bases: st.players[i].draftOptions.slice(0, 3) };
          if (this.game.act(i, a).ok) { this.history.push({ p: i, a }); this.dirty = true; this.systemChat(`${this.seats[i]?.name ?? 'Hráč'} je pryč – základny vybrány automaticky.`); this.broadcastState(); }
        }
      }
      return;
    }
    if (st.phase === 'chooseFirst' && awayLong(st.coinWinner)) {
      const a: Action = { t: 'chooseFirst', first: st.coinWinner };
      if (this.game.act(st.coinWinner, a).ok) { this.history.push({ p: st.coinWinner, a }); this.dirty = true; this.broadcastState(); }
      return;
    }
    // optional turn timer
    if ((this.options.turnSeconds ?? 0) > 0 && st.phase === 'play') {
      const changed = this.syncTimer(now);
      if (changed) this.broadcastRoom();
      const left = this.turnLeft(now);
      if (left !== null && left <= 0) {
        const pr = st.pending;
        let a: Action;
        let p: PlayerIdx;
        if (pr) {
          const ids = pr.options.map((o) => o.id);
          const choice = pr.kind === 'order' ? ids : pr.kind === 'multi' ? ids.slice(0, pr.min ?? 0) : pr.optional ? [] : ids.slice(0, 1);
          a = { t: 'answer', promptId: pr.id, choice };
          p = pr.player;
        } else {
          a = { t: 'endTurn' };
          p = st.active;
        }
        const res = this.game.act(p, a);
        if (res.ok) {
          this.history.push({ p, a });
          this.dirty = true;
          this.systemChat(`⏱ ${this.seats[p]?.name ?? 'Hráč'}: čas vypršel${pr ? ' – volba provedena automaticky' : ' – tah končí'}.`);
          this.broadcastState();
          this.broadcastRoom();
        }
        return;
      }
    }
    const away = (i: PlayerIdx) => {
      const s = this.seats[i];
      return s && !s.client && s.awaySince ? now - s.awaySince : 0;
    };
    const pr = st.pending;
    if (pr && away(pr.player) >= AUTO_ANSWER_MS) {
      const ids = pr.options.map((o) => o.id);
      let choice: string[];
      if (pr.kind === 'order') choice = ids;
      else if (pr.kind === 'multi') choice = ids.slice(0, pr.min ?? 0);
      else if (pr.optional) choice = [];
      else choice = ids.slice(0, 1);
      const res = this.game.act(pr.player, { t: 'answer', promptId: pr.id, choice });
      if (res.ok) {
        this.history.push({ p: pr.player, a: { t: 'answer', promptId: pr.id, choice } });
        this.dirty = true;
        this.systemChat(`${this.seats[pr.player]?.name ?? 'Hráč'} je pryč – volba byla provedena automaticky.`);
        this.broadcastState();
      }
    }
    if ((away(0) > 0 || away(1) > 0) && now - this.lastAwayBroadcast > 5000) {
      this.lastAwayBroadcast = now;
      this.broadcastRoom();
    }
  }

  /** The connected player can claim the win when the opponent has been away too long. */
  claimWin(c: Client) {
    const seat = this.seatOf(c);
    if (seat === null || !this.game || this.game.state.phase === 'over') return;
    const o = (1 - seat) as PlayerIdx;
    const s = this.seats[o];
    if (!s || s.client || !s.awaySince || Date.now() - s.awaySince < CLAIM_WIN_MS) {
      send(c, { t: 'error', msg: 'Soupeř ještě není dost dlouho pryč.' });
      return;
    }
    this.systemChat(`${c.name} bere výhru – soupeř se nevrátil.`);
    this.act({ ...c, room: this } as Client, { t: 'concede' }, o);
  }

  /** Rewards need two different registered players who both really played. */
  private rewardsEligible(): boolean {
    const [s0, s1] = this.seats;
    if (!s0?.user || !s1?.user || s0.user.toLowerCase() === s1.user.toLowerCase()) return false;
    const meaningful = new Set(['playPerson', 'playEvent', 'ability', 'junk']);
    const counts = [0, 0];
    for (const h of this.history) if (meaningful.has(h.a.t)) counts[h.p]++;
    return counts[0] >= 3 && counts[1] >= 3;
  }

  private giveRewards() {
    if (!this.accounts || !this.game) return;
    const st = this.game.state;
    const eligible = this.rewardsEligible();
    for (const i of [0, 1] as PlayerIdx[]) {
      const s = this.seats[i];
      if (!s?.user) continue;
      const result = st.winner === 'draw' ? 'draw' : st.winner === i ? 'win' : 'loss';
      const gain = eligible ? this.accounts.reward(s.user, result, st.turn) : 0;
      if (s.client) send(s.client, { t: 'reward', gain, result });
    }
  }

  requestRematch(c: Client) {
    const seat = this.seatOf(c);
    if (seat === null || !this.game || this.game.state.phase !== 'over') return;
    this.rematch[seat] = true;
    this.systemChat(`${c.name} chce odvetu.`);
    if (this.rematch[0] && this.rematch[1]) this.startGame();
    else this.broadcastRoom();
  }

  chatFrom(c: Client, text: string) {
    const clean = text.replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!clean) return;
    this.pushChat({ from: c.name, seat: this.seatOf(c), text: clean, ts: Date.now() });
  }

  emoteFrom(c: Client, id: string) {
    if (!isEmote(id)) return;
    for (const o of this.allClients()) send(o, { t: 'emote', seat: this.seatOf(c), id, from: c.name });
  }

  snapshot(): RoomSnapshot {
    return {
      code: this.code, options: this.options,
      seats: this.seats.map((s) => (s ? { token: s.token, name: s.name, user: s.user ?? null, deck: s.deck ?? null } : null)) as RoomSnapshot['seats'],
      gameDecks: this.gameDecks,
      seed: this.seed, names: this.names, history: this.history, chat: this.chat.slice(-50),
      score: this.score, gameNo: this.gameNo, rematch: this.rematch, lastActivity: this.lastActivity, started: !!this.game,
    };
  }

  static fromSnapshot(s: RoomSnapshot): Room {
    const r = new Room(s.code, s.options);
    r.seats = s.seats.map((x) => (x ? { token: x.token, name: x.name, client: null, user: x.user ?? null, deck: x.deck ?? null } : null)) as Room['seats'];
    r.gameDecks = s.gameDecks ?? null;
    r.seed = s.seed;
    r.names = s.names;
    r.chat = s.chat ?? [];
    r.score = s.score ?? [0, 0];
    r.gameNo = s.gameNo ?? 0;
    r.rematch = s.rematch ?? [false, false];
    r.lastActivity = s.lastActivity ?? Date.now();
    if (s.started) {
      const g = Game.create({ names: s.names, seed: s.seed, baseMode: s.options.baseMode, decks: s.gameDecks ?? undefined });
      for (const h of s.history) {
        const res = g.act(h.p, h.a);
        if (!res.ok) throw new Error(`replay failed in room ${s.code}: ${res.error}`);
      }
      r.game = g;
      r.history = [...s.history];
    }
    r.dirty = false;
    return r;
  }

  isDead(now: number): boolean {
    const anyone = this.allClients().length > 0;
    const idle = now - this.lastActivity;
    return (!anyone && idle > 1000 * 60 * 60 * 3) || idle > 1000 * 60 * 60 * 24;
  }
}

interface SeatSnap { token: string; name: string; user?: string | null; deck?: Record<string, number> | null }

export interface RoomSnapshot {
  code: string;
  options: RoomOptions;
  seats: [SeatSnap | null, SeatSnap | null];
  gameDecks?: [string[], string[]] | null;
  seed: number;
  names: [string, string];
  history: { p: PlayerIdx; a: Action }[];
  chat: ChatLine[];
  score: [number, number];
  gameNo: number;
  rematch: [boolean, boolean];
  lastActivity: number;
  started: boolean;
}

export function send(c: Client, msg: ServerMsg) {
  if (c.ws.readyState === 1) c.ws.send(JSON.stringify(msg));
}

export class Lobby {
  rooms = new Map<string, Room>();

  constructor(public accounts: Accounts | null = null) {}

  newCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < 4; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
  }

  create(options: RoomOptions): Room {
    const room = new Room(this.newCode(), options);
    room.accounts = this.accounts;
    this.rooms.set(room.code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.trim().toUpperCase());
  }

  tick() {
    const now = Date.now();
    for (const r of this.rooms.values()) {
      try { r.tick(now); } catch (e) { console.warn('room tick failed', r.code, e); }
    }
  }

  sweep() {
    const now = Date.now();
    for (const [code, r] of this.rooms) if (r.isDead(now)) { this.rooms.delete(code); this.removed = true; }
  }

  removed = false;

  /** Persist all rooms (replay logs) to a JSON file if anything changed. */
  /** Serialized rooms (replay logs), or null when nothing changed. Marks clean. */
  dumps(force = false): string | null {
    const changed = this.removed || [...this.rooms.values()].some((r) => r.dirty);
    if (!changed && !force) return null;
    const data = [...this.rooms.values()].map((r) => r.snapshot());
    for (const r of this.rooms.values()) r.dirty = false;
    this.removed = false;
    return JSON.stringify({ v: 1, rooms: data });
  }

  loads(json: string): number {
    const data = JSON.parse(json) as { rooms: RoomSnapshot[] };
    let n = 0;
    for (const s of data.rooms ?? []) {
      try {
        const r = Room.fromSnapshot(s);
        r.accounts = this.accounts;
        this.rooms.set(s.code, r);
        n++;
      } catch (e) {
        console.warn('Nelze obnovit stůl', s.code, e);
      }
    }
    return n;
  }

  save(file: string, force = false) {
    const changed = this.removed || [...this.rooms.values()].some((r) => r.dirty);
    if (!changed && !force) return;
    const data = [...this.rooms.values()].map((r) => r.snapshot());
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(`${file}.tmp`, JSON.stringify({ v: 1, rooms: data }));
    renameSync(`${file}.tmp`, file);
    for (const r of this.rooms.values()) r.dirty = false;
    this.removed = false;
  }

  load(file: string): number {
    if (!existsSync(file)) return 0;
    try {
      const data = JSON.parse(readFileSync(file, 'utf8')) as { rooms: RoomSnapshot[] };
      let n = 0;
      for (const s of data.rooms ?? []) {
        try {
          const r = Room.fromSnapshot(s);
          r.accounts = this.accounts;
          this.rooms.set(s.code, r);
          n++;
        } catch (e) {
          console.warn('Nelze obnovit stůl', s.code, e);
        }
      }
      return n;
    } catch (e) {
      console.warn('Nelze načíst uložené stoly:', e);
      return 0;
    }
  }
}
