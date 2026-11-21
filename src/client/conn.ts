// Connection layer: the UI talks to a Conn, which is either a WebSocket
// connection to the game server or a local in-browser game (bot / hot-seat).

import { botMove } from '../engine/bot';
import { Game } from '../engine/game';
import type { Action, PlayerIdx } from '../engine/types';
import { buildView, type GameView } from '../engine/view';
import { isEmote, type ChatLine, type ClientMsg, type RoomInfo, type RoomOptions, type ServerMsg } from '../shared/protocol';
import { account, refreshProfile } from './account';

export interface EmoteEvent { seat: PlayerIdx | null; id: string; from: string; ts: number }

export interface ConnState {
  mode: 'online' | 'bot' | 'hotseat';
  status: 'connecting' | 'connected' | 'disconnected';
  room: RoomInfo | null;
  view: GameView | null;
  chat: ChatLine[];
  emotes: EmoteEvent[];
  errors: { id: number; msg: string }[];
  botThinking: boolean;
  left?: boolean;
  reward?: { gain: number; result: 'win' | 'loss' | 'draw' };
  fatal?: string;
  /** Local timestamp when the current timed decision runs out (turn timer). */
  turnDeadline?: number | null;
}

type Listener = (s: ConnState) => void;

let errId = 0;

export abstract class Conn {
  state: ConnState;
  private listeners = new Set<Listener>();

  constructor(mode: ConnState['mode']) {
    this.state = { mode, status: 'connecting', room: null, view: null, chat: [], emotes: [], errors: [], botThinking: false };
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => { this.listeners.delete(fn); };
  }

  protected set(patch: Partial<ConnState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
  }

  protected error(msg: string) {
    const id = ++errId;
    this.set({ errors: [...this.state.errors, { id, msg }] });
    setTimeout(() => this.set({ errors: this.state.errors.filter((e) => e.id !== id) }), 3800);
  }

  abstract act(action: Action): void;
  /** Pause local bots (e.g. while reading the tutorial). */
  pause(_p: boolean): void { /* online: no-op */ }
  abstract chat(text: string): void;
  abstract emote(id: string): void;
  abstract rematch(): void;
  abstract close(): void;
}

// ---------------------------------------------------------------------------
// Online (WebSocket)
// ---------------------------------------------------------------------------

export function wsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

export class NetConn extends Conn {
  private ws: WebSocket | null = null;
  private retry = 0;
  private closed = false;
  private intent: { t: 'create'; options: RoomOptions; deckId?: string } | { t: 'join'; code: string; spectate?: boolean; deckId?: string };
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private name: string, private token: string, intent: NetConn['intent']) {
    super('online');
    this.intent = intent;
    this.connect();
  }

  private connect() {
    if (this.closed) return;
    this.set({ status: 'connecting' });
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl());
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.set({ status: 'connected' });
      this.send({ t: 'hello', token: this.token, name: this.name, account: account.session() ?? undefined });
      if (this.intent.t === 'create') this.send({ t: 'create', options: this.intent.options, deckId: this.intent.deckId });
      else this.send({ t: 'join', code: this.intent.code, spectate: this.intent.spectate, deckId: this.intent.deckId });
      this.pingTimer = setInterval(() => this.send({ t: 'ping', ts: Date.now() }), 20000);
    };
    ws.onmessage = (ev) => {
      let msg: ServerMsg;
      try { msg = JSON.parse(String(ev.data)); } catch { return; }
      this.onMsg(msg);
    };
    ws.onclose = () => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.ws = null;
      if (!this.closed) {
        this.set({ status: 'disconnected' });
        this.scheduleReconnect();
      }
    };
    ws.onerror = () => { /* close follows */ };
  }

  private scheduleReconnect() {
    const delay = Math.min(8000, 500 * 2 ** this.retry++);
    setTimeout(() => this.connect(), delay);
  }

  private onMsg(msg: ServerMsg) {
    switch (msg.t) {
      case 'room':
        this.set({ room: msg.room, turnDeadline: msg.room.turnLeftMs != null ? Date.now() + msg.room.turnLeftMs : null });
        // after the room exists, reconnects should join it instead of creating a new one
        this.intent = { t: 'join', code: msg.room.code, deckId: this.intent.deckId };
        if (history.replaceState && !location.hash.includes(msg.room.code)) history.replaceState(null, '', `#/room/${msg.room.code}`);
        break;
      case 'state':
        this.set({ view: msg.view });
        break;
      case 'error':
        if (!this.state.room && (msg.code === 'no_room' || /přihlas|Balíček|balíček/.test(msg.msg))) {
          this.fatalStop(msg.msg);
          break;
        }
        this.error(msg.msg);
        break;
      case 'chat':
        this.set({ chat: [...this.state.chat, msg.line].slice(-200) });
        break;
      case 'chatHistory':
        this.set({ chat: msg.lines });
        break;
      case 'emote':
        if (!isEmote(msg.id)) break;
        this.set({ emotes: [...this.state.emotes, { seat: msg.seat, id: msg.id, from: msg.from, ts: Date.now() }].slice(-10) });
        break;
      case 'left':
        this.set({ left: true });
        break;
      case 'reward':
        this.set({ reward: { gain: msg.gain, result: msg.result } });
        void refreshProfile();
        break;
    }
  }

  /** Unrecoverable join error: stop reconnecting and show it. */
  private fatalStop(msg: string) {
    this.closed = true;
    this.set({ fatal: msg, status: 'connected' });
    this.ws?.close();
  }

  private send(m: ClientMsg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  act(action: Action) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.error('Nejsi připojen(a) – zkouším to znovu…');
      return;
    }
    this.send({ t: 'act', action });
  }
  chat(text: string) { this.send({ t: 'chat', text }); }
  emote(id: string) { this.send({ t: 'emote', id }); }
  rematch() { this.send({ t: 'rematch' }); }
  claimWin() { this.send({ t: 'claimWin' }); }
  close() {
    this.closed = true;
    this.send({ t: 'leave' });
    this.ws?.close();
  }
}

// ---------------------------------------------------------------------------
// Local game (vs bot or hot-seat)
// ---------------------------------------------------------------------------

export class LocalConn extends Conn {
  game: Game;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private names: [string, string];
  private gameNo = 1;
  private paused = false;

  override pause(p: boolean) {
    this.paused = p;
    if (!p) this.scheduleBot();
  }
  private score: [number, number] = [0, 0];
  private counted = false;

  constructor(mode: 'bot' | 'hotseat', names: [string, string], private options: RoomOptions & { botLevel?: 'easy' | 'normal' | 'hard' }) {
    super(mode);
    this.names = names;
    this.game = Game.create({ names, baseMode: options.baseMode });
    this.set({ status: 'connected', room: this.fakeRoom() });
    this.refresh();
  }

  private fakeRoom(): RoomInfo {
    return {
      code: this.state.mode === 'bot' ? 'BOT' : 'LOKÁL',
      seats: [{ name: this.names[0], connected: true, account: false }, { name: this.names[1], connected: true, account: false }],
      you: 0, spectators: 0, status: this.game.state.phase === 'over' ? 'over' : 'playing',
      options: this.options, rematch: [false, false], gameNo: this.gameNo, score: this.score,
    };
  }

  /** In hot-seat, the viewer is whoever must decide now. */
  viewer(): PlayerIdx {
    const st = this.game.state;
    if (this.state.mode === 'bot') return 0;
    if (st.pending) return st.pending.player;
    if (st.phase === 'draft') return st.players[0].draftPicked ? 1 : 0;
    if (st.phase === 'chooseFirst') return st.coinWinner;
    return st.active;
  }

  private countScore() {
    const st = this.game.state;
    if (st.phase === 'over' && !this.counted) {
      this.counted = true;
      if (st.winner === 0 || st.winner === 1) this.score[st.winner]++;
    }
  }

  private refresh() {
    this.countScore();
    const v = buildView(this.game, this.viewer());
    this.set({ view: v, room: this.fakeRoom() });
    this.scheduleBot();
  }

  act(action: Action) {
    const p = this.viewer();
    const res = this.game.act(p, action);
    if (!res.ok) {
      this.error(res.error);
      return;
    }
    this.refresh();
  }

  private scheduleBot() {
    if (this.state.mode !== 'bot' || this.timer || this.paused) return;
    const st = this.game.state;
    if (st.phase === 'over') return;
    const bot: PlayerIdx = 1;
    const needs = (st.phase === 'draft' && !st.players[1].draftPicked)
      || (st.phase === 'chooseFirst' && st.coinWinner === bot)
      || (st.pending && st.pending.player === bot)
      || (!st.pending && st.phase === 'play' && st.active === bot);
    if (!needs) return;
    this.set({ botThinking: true });
    const delay = st.pending ? 700 : st.phase === 'draft' ? 900 : 1250;
    this.timer = setTimeout(() => {
      this.timer = null;
      let a: Action | null = null;
      try {
        a = botMove(this.game, bot, { level: this.options.botLevel ?? 'normal' });
      } catch (e) {
        console.error('bot error', e);
      }
      this.set({ botThinking: false });
      if (!a) return;
      const res = this.game.act(bot, a);
      if (!res.ok) {
        console.warn('bot illegal move', a, res.error);
        const fallback = this.game.state.pending?.player === bot ? null : { t: 'endTurn' } as Action;
        if (fallback) this.game.act(bot, fallback);
      }
      this.countScore();
      const view = buildView(this.game, 0);
      this.set({ view, room: this.fakeRoom() });
      this.scheduleBot();
    }, delay);
  }

  chat(text: string) {
    this.set({ chat: [...this.state.chat, { from: this.names[this.viewer()], seat: this.viewer(), text, ts: Date.now() }] });
  }
  emote(id: string) {
    this.set({ emotes: [...this.state.emotes, { seat: this.viewer(), id, from: this.names[this.viewer()], ts: Date.now() }].slice(-10) });
    if (this.state.mode === 'bot' && Math.random() < 0.7) {
      setTimeout(() => this.set({ emotes: [...this.state.emotes, { seat: 1 as PlayerIdx, id: ['gg', 'think', 'wow', 'hi'][Math.floor(Math.random() * 4)], from: this.names[1], ts: Date.now() }].slice(-10) }), 1200);
    }
  }
  rematch() {
    this.gameNo++;
    this.counted = false;
    this.game = Game.create({ names: this.names, baseMode: this.options.baseMode });
    this.refresh();
  }
  close() {
    if (this.timer) clearTimeout(this.timer);
  }
}
