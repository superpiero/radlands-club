// Core types for "Poslední kapka" rules engine.
// The engine is pure TypeScript (no DOM / Node APIs) so it runs both
// on the server (authoritative) and in the browser (bot & hot-seat modes).

export type PlayerIdx = 0 | 1;

export type JunkKind = 'raid' | 'injure' | 'restore' | 'draw' | 'drifter' | 'water';

export type CardKind = 'survivor' | 'operation' | 'base' | 'raid' | 'cistern';

/** A physical card instance (unique uid) referencing a card definition id. */
export interface CardInst {
  uid: string;
  id: string;
}

export interface PersonInPlay {
  uid: string;
  /** Card definition id. For face-down drifters this is the real hidden card. */
  id: string;
  faceDown: boolean;
  damaged: boolean;
  playedTurn: number;
  usedTurn: number;
  restoredTurn: number;
  stunnedTurn: number;
  /** Water stashed on the card (Skladnice Marta). */
  stash: number;
}

export interface BaseInPlay {
  uid: string;
  id: string;
  /** Number of damage tokens (0 = intact). Normally max 1 before destruction. */
  damage: number;
  destroyed: boolean;
  usedTurn: number;
  /** Which player's demolition charge sits on this base. */
  charge: PlayerIdx | null;
  /** Water stored in the base (Přehrada). */
  stored: number;
}

export interface PlayerState {
  name: string;
  hand: CardInst[];
  bases: BaseInPlay[];
  /** columns[c] = people in front of base c; index 0 = next to base (behind), last = front. */
  columns: PersonInPlay[][];
  /** Event queue, index 0 = slot 1 (resolves next). */
  queue: (CardInst | null)[];
  raidHome: boolean;
  cisternHome: boolean;
  water: number;
  waterPenalty: number;
  /** exposedTurn[c] === current turn => column c counts as unprotected. */
  exposedTurn: number[];
  drawDiscountTurn: number;
  personDiscountTurn: number;
  sentryTurn: number;
  draftOptions: string[];
  draftPicked: string[] | null;
  /** Personal deck mode only: own draw pile (index 0 = top) and discard pile. */
  deck?: CardInst[];
  discard?: CardInst[];
  reshuffles?: number;
  /** Bot/hint flag only, never used for rules. */
  isBot?: boolean;
}

export type LogKind = 'info' | 'turn' | 'damage' | 'destroy' | 'play' | 'event' | 'water' | 'draw' | 'win' | 'chat';

export interface LogEntry {
  turn: number;
  player: PlayerIdx | null;
  kind: LogKind;
  text: string;
  /** Optional private replacements visible only to the given player. */
  priv?: { player: PlayerIdx; text: string };
  /** Card ids mentioned (for hover previews). */
  cards?: string[];
}

export type Ref =
  | { t: 'person'; uid: string }
  | { t: 'base'; uid: string }
  | { t: 'event'; uid: string }
  | { t: 'hand'; uid: string }
  | { t: 'slot'; player: PlayerIdx; col: number; pos: 'back' | 'front' | 'only' }
  | { t: 'column'; player: PlayerIdx; col: number }
  | { t: 'card'; id: string; uid?: string }
  | { t: 'none' };

export interface PromptOption {
  id: string;
  label: string;
  ref?: Ref;
  /** Visual hint: is this a "bad"/self-harm choice etc. */
  tone?: 'danger' | 'good' | 'neutral';
}

export type PromptKind = 'pick' | 'multi' | 'order' | 'reveal';

export interface Prompt {
  id: number;
  player: PlayerIdx;
  kind: PromptKind;
  title: string;
  options: PromptOption[];
  /** For multi: selection limits. */
  min?: number;
  max?: number;
  optional?: boolean;
  /** Cards revealed only to the chooser (e.g. top of the deck). */
  reveal?: CardInst[];
  sourceUid?: string;
}

export type Answer = string[];

export type Action =
  | { t: 'draftPick'; bases: string[] }
  | { t: 'chooseFirst'; first: PlayerIdx }
  | { t: 'playPerson'; uid: string; col?: number; pos?: 'back' | 'front' | 'only' }
  | { t: 'playEvent'; uid: string }
  | { t: 'junk'; uid: string }
  | { t: 'drawCard' }
  | { t: 'takeCistern' }
  | { t: 'ability'; uid: string; idx: number }
  | { t: 'endTurn' }
  | { t: 'undo' }
  | { t: 'cancel' }
  | { t: 'answer'; promptId: number; choice: Answer }
  | { t: 'concede' };

export type Phase = 'draft' | 'chooseFirst' | 'play' | 'over';
export type Step = 'start' | 'events' | 'replenish' | 'actions';

export interface GameOptions {
  names: [string, string];
  seed?: number;
  /** 'draft' = pick 3 of 6 bases; 'random' = random 3 bases. */
  baseMode?: 'draft' | 'random';
  /** Personal decks (collection mode): card ids for each player. Omit = classic shared deck. */
  decks?: [string[], string[]];
}

export interface GameState {
  version: 1;
  seed: number;
  rng: number[];
  opts: { baseMode: 'draft' | 'random'; personal?: boolean };
  players: [PlayerState, PlayerState];
  /** deck[0] is the top card. */
  deck: CardInst[];
  /** Last element is the top of the discard pile. */
  discard: CardInst[];
  turn: number;
  active: PlayerIdx;
  first: PlayerIdx;
  coinWinner: PlayerIdx;
  phase: Phase;
  step: Step;
  pending: Prompt | null;
  winner: PlayerIdx | 'draw' | null;
  winReason: string | null;
  reshuffles: number;
  log: LogEntry[];
  /** Total log entries ever written (log itself is capped). */
  logTotal?: number;
  seq: number;
  promptSeq: number;
  /** Monotonic counter, bumps on every successful act(). */
  rev: number;
  /** Short-lived visual effects for clients (cleared each act). */
  fx: Fx[];
}

export type Fx =
  | { t: 'damage'; uid: string; destroyed?: boolean }
  | { t: 'restore'; uid: string }
  | { t: 'play'; uid: string; player: PlayerIdx }
  | { t: 'draw'; player: PlayerIdx; n: number }
  | { t: 'water'; player: PlayerIdx; n: number }
  | { t: 'raid'; player: PlayerIdx }
  | { t: 'event'; uid: string; player: PlayerIdx; id: string }
  | { t: 'junk'; player: PlayerIdx; id: string }
  | { t: 'ability'; uid: string; player: PlayerIdx }
  | { t: 'turn'; player: PlayerIdx }
  | { t: 'boom'; uid: string }
  | { t: 'stun'; uid: string };
