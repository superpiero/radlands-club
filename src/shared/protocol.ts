// Wire protocol between browser and game server (JSON over WebSocket).

import type { Action, PlayerIdx } from '../engine/types';
import type { GameView } from '../engine/view';

export interface RoomOptions {
  baseMode: 'draft' | 'random';
  /** classic = one shared deck; collection = each player brings a deck from their collection. */
  deckMode?: 'classic' | 'collection';
}

export interface SeatInfo {
  name: string;
  connected: boolean;
  /** registered account (not a guest) */
  account: boolean;
  /** how long the player has been disconnected (ms), 0 = online */
  awayMs?: number;
}

export interface RoomInfo {
  code: string;
  seats: [SeatInfo | null, SeatInfo | null];
  you: PlayerIdx | null;
  spectators: number;
  status: 'waiting' | 'playing' | 'over';
  options: RoomOptions;
  rematch: [boolean, boolean];
  /** After this many ms away the other player may claim the win. */
  claimWinMs?: number;
  /** Wins in this room's series (by seat). */
  score: [number, number];
  gameNo: number;
}

export type ClientMsg =
  | { t: 'hello'; token: string; name: string; account?: string }
  | { t: 'create'; options: RoomOptions; deckId?: string }
  | { t: 'join'; code: string; spectate?: boolean; deckId?: string }
  | { t: 'act'; action: Action }
  | { t: 'chat'; text: string }
  | { t: 'emote'; id: string }
  | { t: 'rematch' }
  | { t: 'claimWin' }
  | { t: 'leave' }
  | { t: 'ping'; ts: number };

export interface ChatLine {
  from: string;
  seat: PlayerIdx | null;
  text: string;
  ts: number;
  system?: boolean;
}

export type ServerMsg =
  | { t: 'welcome'; version: string }
  | { t: 'room'; room: RoomInfo }
  | { t: 'left' }
  | { t: 'state'; view: GameView }
  | { t: 'error'; msg: string; code?: 'no_room' | 'need_login' | 'bad_deck' }
  | { t: 'chat'; line: ChatLine }
  | { t: 'chatHistory'; lines: ChatLine[] }
  | { t: 'emote'; seat: PlayerIdx | null; id: string; from: string }
  | { t: 'pong'; ts: number }
  | { t: 'reward'; gain: number; result: 'win' | 'loss' | 'draw' };

export const PROTOCOL_VERSION = '1';

export function isEmote(id: unknown): id is string {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(EMOTES, id);
}

export const EMOTES: Record<string, string> = {
  hi: 'Ahoj! 👋',
  gg: 'Dobrá hra! 🤝',
  wow: 'Páni! 😮',
  oops: 'Jejda… 😅',
  think: 'Hmm… 🤔',
  fire: 'Hoří to! 🔥',
  water: 'Žízeň… 💧',
  angry: 'Grrr! 😤',
};
