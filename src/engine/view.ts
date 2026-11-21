// Per-player sanitised view of the game state (hides hidden information).

import { cardDef } from './cards';
import type { Game, LegalInfo } from './game';
import type { CardInst, Fx, GameState, LogEntry, Phase, PlayerIdx, Prompt, Step } from './types';

export interface PersonView {
  uid: string;
  id: string; // 'tulak' when face down
  faceDown: boolean;
  damaged: boolean;
  ready: boolean;
  notReady: string | null;
  stunned: boolean;
  /** Stunned for the owner's next turn (shown to both). */
  stunPending: boolean;
  stash: number;
  justPlayed: boolean;
}

export interface BaseView {
  uid: string;
  id: string;
  damage: number;
  hp: number;
  destroyed: boolean;
  ready: boolean;
  charge: PlayerIdx | null;
  stored: number;
  immune: boolean;
}

export interface PlayerView {
  name: string;
  handCount: number;
  hand: CardInst[] | null;
  bases: BaseView[];
  columns: PersonView[][];
  queue: (CardInst | null)[];
  raidHome: boolean;
  cisternHome: boolean;
  water: number;
  waterPenalty: number;
  exposed: boolean[];
  draftOptions: string[] | null;
  draftDone: boolean;
  peopleCount: number;
  /** Own draw pile size (personal deck mode) – equals the shared deck in classic mode. */
  deckCount: number;
  discardTop: CardInst | null;
  discardCount: number;
  reshuffles: number;
}

export interface GameView {
  you: PlayerIdx | null;
  rev: number;
  turn: number;
  active: PlayerIdx;
  first: PlayerIdx;
  coinWinner: PlayerIdx;
  phase: Phase;
  step: Step;
  winner: PlayerIdx | 'draw' | null;
  winReason: string | null;
  /** true = each player has their own deck (collection mode). */
  personal: boolean;
  players: [PlayerView, PlayerView];
  deckCount: number;
  discardTop: CardInst | null;
  discardCount: number;
  reshuffles: number;
  pending: Prompt | null;
  /** Public info about a pending decision of the other player. */
  waitingFor: { player: PlayerIdx; title: string } | null;
  log: { turn: number; player: PlayerIdx | null; kind: LogEntry['kind']; text: string; cards?: string[] }[];
  fx: Fx[];
  canUndo: boolean;
  canCancel: boolean;
  /** Match statistics – only sent once the game is over. */
  stats: GameState['stats'] | null;
  legal: LegalInfo | null;
}

export function buildView(g: Game, viewer: PlayerIdx | null): GameView {
  const st = g.state;
  const t = st.turn;
  const players = st.players.map((pl, idx) => {
    const p = idx as PlayerIdx;
    const showHand = viewer === p;
    const pv: PlayerView = {
      name: pl.name,
      handCount: pl.hand.length,
      hand: showHand ? pl.hand.map((h) => ({ ...h })) : null,
      bases: pl.bases.map((b, col) => ({
        uid: b.uid, id: b.id, damage: b.damage, hp: cardDef(b.id).hp ?? 2, destroyed: b.destroyed,
        ready: g.isBaseReady(b), charge: b.charge, stored: b.stored, immune: g.bunkerImmune(p, col),
      })),
      columns: pl.columns.map((column) => column.map((x) => ({
        uid: x.uid,
        id: x.faceDown ? 'tulak' : x.id,
        faceDown: x.faceDown,
        damaged: x.damaged,
        ready: g.isPersonReady(x),
        notReady: g.notReadyReason(x),
        stunned: x.stunnedTurn === t,
        stunPending: x.stunnedTurn > t,
        stash: x.stash,
        justPlayed: x.playedTurn === t,
      }))),
      queue: pl.queue.map((e) => (e ? { ...e } : null)),
      raidHome: pl.raidHome,
      cisternHome: pl.cisternHome,
      water: pl.water,
      waterPenalty: pl.waterPenalty,
      exposed: [0, 1, 2].map((c) => pl.exposedTurn[c] === t),
      draftOptions: viewer === p && st.phase === 'draft' ? [...pl.draftOptions] : null,
      draftDone: !!pl.draftPicked,
      peopleCount: pl.columns.reduce((s, c) => s + c.length, 0),
      deckCount: g.deckOf(p).length,
      discardTop: g.discardOf(p).length ? { ...g.discardOf(p)[g.discardOf(p).length - 1] } : null,
      discardCount: g.discardOf(p).length,
      reshuffles: st.opts.personal ? pl.reshuffles ?? 0 : st.reshuffles,
    };
    return pv;
  }) as [PlayerView, PlayerView];

  let pending: Prompt | null = null;
  let waitingFor: GameView['waitingFor'] = null;
  if (st.pending) {
    if (viewer === st.pending.player) pending = structuredClone(st.pending);
    else {
      const pr = st.pending;
      const what = pr.kind === 'order' ? 'řadí karty' : pr.kind === 'reveal' ? 'prohlíží si karty' : pr.kind === 'multi' ? 'vybírá karty'
        : /NÁJEZD/.test(pr.title) ? 'vybírá, kterou základnu obětuje Nájezdu' : /Kam postavíš/.test(pr.title) ? 'vybírá místo'
        : /Hlídkař/.test(pr.title) ? 'zvažuje odvetu Hlídkaře' : 'vybírá cíl';
      waitingFor = { player: pr.player, title: what };
    }
  }

  const log = st.log.slice(-150).map((e) => ({
    turn: e.turn,
    player: e.player,
    kind: e.kind,
    text: e.priv && e.priv.player === viewer ? e.priv.text : e.text,
    cards: e.cards,
  }));

  return {
    you: viewer,
    rev: st.rev,
    turn: st.turn,
    active: st.active,
    first: st.first,
    coinWinner: st.coinWinner,
    phase: st.phase,
    step: st.step,
    winner: st.winner,
    winReason: st.winReason,
    personal: !!st.opts.personal,
    players,
    deckCount: players[viewer ?? 0].deckCount,
    discardTop: players[viewer ?? 0].discardTop,
    discardCount: players[viewer ?? 0].discardCount,
    reshuffles: players[viewer ?? 0].reshuffles,
    pending,
    waitingFor,
    log,
    fx: [...st.fx],
    stats: st.phase === 'over' ? structuredClone(st.stats ?? null) : null,
    canUndo: viewer !== null && g.canUndo(viewer),
    canCancel: viewer !== null && g.canCancel(viewer),
    legal: viewer !== null ? g.legalInfo(viewer) : null,
  };
}
