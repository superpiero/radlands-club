// Room management: seats, reconnection, broadcasting per-player views.

import type { WebSocket } from 'ws';
import { Game } from '../engine/game';
import type { Action, PlayerIdx } from '../engine/types';
import { buildView } from '../engine/view';
import { EMOTES, type ChatLine, type RoomInfo, type RoomOptions, type ServerMsg } from '../shared/protocol';

export interface Client {
  ws: WebSocket;
  token: string;
  name: string;
  room: Room | null;
  lastMsgs: number[];
}

interface Seat {
  token: string;
  name: string;
  client: Client | null;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class Room {
  code: string;
  options: RoomOptions;
  seats: [Seat | null, Seat | null] = [null, null];
  spectators = new Set<Client>();
  game: Game | null = null;
  history: { p: PlayerIdx; a: Action }[] = [];
  seed = 0;
  chat: ChatLine[] = [];
  rematch: [boolean, boolean] = [false, false];
  gameNo = 0;
  lastActivity = Date.now();

  constructor(code: string, options: RoomOptions) {
    this.code = code;
    this.options = options;
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
      seats: this.seats.map((s) => (s ? { name: s.name, connected: !!s.client } : null)) as RoomInfo['seats'],
      you: this.seatOf(forClient),
      spectators: this.spectators.size,
      status: this.status(),
      options: this.options,
      rematch: this.rematch,
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
  join(c: Client, spectate = false): string | null {
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
        this.seats[free] = { token: c.token, name: c.name, client: c };
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
    this.seed = Math.floor(Math.random() * 2 ** 31);
    this.game = Game.create({ names, seed: this.seed, baseMode: this.options.baseMode });
    this.history = [];
    this.rematch = [false, false];
    this.gameNo++;
    this.systemChat(this.gameNo > 1 ? `Odveta! Hra č. ${this.gameNo} začíná.` : 'Hra začíná! Vyberte si základny.');
    this.broadcastRoom();
    this.broadcastState();
  }

  act(c: Client, action: Action) {
    this.lastActivity = Date.now();
    const seat = this.seatOf(c);
    if (seat === null || !this.game) return send(c, { t: 'error', msg: 'Nejsi hráč u tohoto stolu.' });
    const before = this.game.state.phase;
    const res = this.game.act(seat, action);
    if (!res.ok) return send(c, { t: 'error', msg: res.error });
    this.history.push({ p: seat, a: action });
    this.broadcastState();
    if (before !== 'over' && this.game.state.phase === 'over') this.broadcastRoom();
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
    if (!EMOTES[id]) return;
    for (const o of this.allClients()) send(o, { t: 'emote', seat: this.seatOf(c), id, from: c.name });
  }

  isDead(now: number): boolean {
    const anyone = this.allClients().length > 0;
    const idle = now - this.lastActivity;
    return (!anyone && idle > 1000 * 60 * 60 * 3) || idle > 1000 * 60 * 60 * 24;
  }
}

export function send(c: Client, msg: ServerMsg) {
  if (c.ws.readyState === 1) c.ws.send(JSON.stringify(msg));
}

export class Lobby {
  rooms = new Map<string, Room>();

  newCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < 4; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
  }

  create(options: RoomOptions): Room {
    const room = new Room(this.newCode(), options);
    this.rooms.set(room.code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.trim().toUpperCase());
  }

  sweep() {
    const now = Date.now();
    for (const [code, r] of this.rooms) if (r.isDead(now)) this.rooms.delete(code);
  }
}
