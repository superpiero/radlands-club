// Authoritative rules engine for "Poslední kapka".
//
// Design:
//  * All state lives in a plain JSON-serialisable GameState.
//  * Every top-level Action runs as a generator. Whenever a player must decide
//    something (pick a target, a slot...), the generator yields a Prompt and the
//    engine waits for an {t:'answer'} action from that player.
//  * Snapshots taken at action boundaries give us cancel / undo / bot cloning.

import { BASES, CARDS, CISTERN, cardDef, deckList, JUNK_LABEL, RAID, type CardDef, type Ctx } from './cards';
import { nextRandom, randInt, seedState, shuffleInPlace } from './rng';
import type {
  Action, Answer, BaseInPlay, CardInst, Fx, GameOptions, GameState, JunkKind, LogEntry, LogKind,
  PersonInPlay, PlayerIdx, PlayerState, Prompt, PromptKind, PromptOption,
} from './types';

export type Gen<T = void> = Generator<Prompt, T, Answer>;

export class GameOver {
  constructor(public winner: PlayerIdx | 'draw', public reason: string) {}
}

export interface DamageResult {
  uid: string;
  owner: PlayerIdx;
  kind: 'person' | 'base';
  col?: number;
  destroyed: boolean;
  destroyedPerson: boolean;
}

type DmgKind = 'damage' | 'injure' | 'raid' | 'charge' | 'direct' | 'retaliation';

export interface PersonLoc { owner: PlayerIdx; col: number; idx: number; person: PersonInPlay }
export interface BaseLoc { owner: PlayerIdx; col: number; base: BaseInPlay }

export interface LegalInfo {
  playable: string[];
  junkable: string[];
  abilities: { uid: string; idx: number }[];
  /** Why something is not usable (uid:idx -> reason). */
  blocked: Record<string, string>;
  canDraw: boolean;
  drawCost: number;
  canTakeCistern: boolean;
  canEndTurn: boolean;
  personCost: Record<string, number>;
}

const COL_NAME = ['levý', 'prostřední', 'pravý'];

export function freshState(opts: GameOptions): GameState {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = seedState(seed);
  const mkPlayer = (name: string): PlayerState => ({
    name, hand: [], bases: [], columns: [[], [], []], queue: [null, null, null],
    raidHome: true, cisternHome: true, water: 0, waterPenalty: 0, exposedTurn: [-1, -1, -1],
    drawDiscountTurn: -1, personDiscountTurn: -1, sentryTurn: -1, draftOptions: [], draftPicked: null,
  });
  const st: GameState = {
    version: 1, seed, rng, opts: { baseMode: opts.baseMode ?? 'draft', personal: !!opts.decks },
    players: [mkPlayer(opts.names[0]), mkPlayer(opts.names[1])],
    deck: [], discard: [], turn: 0, active: 0, first: 0, coinWinner: 0,
    phase: 'draft', step: 'start', pending: null, winner: null, winReason: null,
    reshuffles: 0, log: [], seq: 0, promptSeq: 0, rev: 0, fx: [],
  };
  // Deck(s)
  if (opts.decks) {
    for (const p of [0, 1] as PlayerIdx[]) {
      const pl = st.players[p];
      pl.deck = shuffleInPlace(st.rng, [...opts.decks[p]]).map((id) => ({ uid: `c${++st.seq}`, id }));
      pl.discard = [];
      pl.reshuffles = 0;
    }
  } else {
    st.deck = shuffleInPlace(st.rng, deckList()).map((id) => ({ uid: `c${++st.seq}`, id }));
  }
  // Bases: deal 6 to each
  const baseIds = shuffleInPlace(st.rng, BASES.map((b) => b.id));
  st.players[0].draftOptions = baseIds.slice(0, 6);
  st.players[1].draftOptions = baseIds.slice(6, 12);
  st.coinWinner = randInt(st.rng, 2) as PlayerIdx;
  return st;
}

export class Game {
  state: GameState;
  private gen: Gen<unknown> | null = null;
  /** Player who started the current top-level action. */
  actor: PlayerIdx = 0;
  private actionStart: GameState | null = null;
  private actionLog: { p: PlayerIdx; a: Action }[] = [];
  private revealed = false;
  private cancellable = false;
  private undoStack: GameState[] = [];

  constructor(state: GameState) {
    this.state = state;
  }

  static create(opts: GameOptions): Game {
    const g = new Game(freshState(opts));
    g.log(null, 'info', `Nová hra: ${opts.names[0]} vs. ${opts.names[1]}.`);
    if (g.state.opts.baseMode === 'random') {
      for (const p of [0, 1] as PlayerIdx[]) {
        const opts3 = g.state.players[p].draftOptions.slice(0, 3);
        g.state.players[p].draftPicked = opts3;
      }
      g.finishDraft();
    }
    return g;
  }

  // =========================================================================
  // Public API
  // =========================================================================

  act(player: PlayerIdx, action: Action): { ok: true } | { ok: false; error: string } {
    if (player !== 0 && player !== 1) return { ok: false, error: 'Neplatný hráč.' };
    const bad = sanitizeAction(action);
    if (bad) return { ok: false, error: bad };
    const st = this.state;
    if (st.phase === 'over' && action.t !== 'concede') return { ok: false, error: 'Hra skončila.' };
    // safety net: any unexpected engine error rolls the whole state back
    const preAct = structuredClone(st);
    const preGen = this.gen;
    st.fx = [];
    try {
      switch (action.t) {
        case 'concede': {
          if (st.phase === 'over') return { ok: false, error: 'Hra skončila.' };
          this.endGame(this.opp(player), `${this.pn(player)} se vzdal(a).`);
          break;
        }
        case 'draftPick': {
          const err = this.doDraftPick(player, action.bases);
          if (err) return { ok: false, error: err };
          break;
        }
        case 'chooseFirst': {
          if (st.phase !== 'chooseFirst') return { ok: false, error: 'Teď se nevybírá začínající hráč.' };
          if (player !== st.coinWinner) return { ok: false, error: 'Začínajícího hráče vybírá soupeř.' };
          if (action.first !== 0 && action.first !== 1) return { ok: false, error: 'Neplatná volba.' };
          st.first = action.first;
          st.active = action.first;
          st.phase = 'play';
          this.log(player, 'info', `${this.pn(player)} určil(a), že začíná ${this.pn(action.first)}.`);
          this.beginAction(action.first, { t: 'chooseFirst', first: action.first }, this.startTurnGen(action.first), false);
          this.actionLog = [{ p: player, a: action }];
          this.advance(undefined);
          break;
        }
        case 'answer': {
          const pr = st.pending;
          if (!pr || !this.gen) return { ok: false, error: 'Není na co odpovídat.' };
          if (pr.player !== player) return { ok: false, error: 'Teď rozhoduje soupeř.' };
          if (pr.id !== action.promptId) return { ok: false, error: 'Zastaralá volba.' };
          const err = validateAnswer(pr, action.choice);
          if (err) return { ok: false, error: err };
          this.actionLog.push({ p: player, a: action });
          this.advance(action.choice);
          break;
        }
        case 'cancel': {
          if (!this.canCancel(player)) return { ok: false, error: 'Tuto akci už nejde vzít zpět.' };
          this.restore(this.actionStart!);
          this.gen = null;
          this.actionStart = null;
          this.actionLog = [];
          break;
        }
        case 'undo': {
          if (!this.canUndo(player)) return { ok: false, error: 'Není co vrátit.' };
          const snap = this.undoStack.pop()!;
          this.restore(snap);
          this.log(player, 'info', `${this.pn(player)} vzal(a) zpět poslední akci.`);
          break;
        }
        default: {
          const err = this.checkAction(player, action);
          if (err) return { ok: false, error: err };
          this.beginAction(player, action, this.runAction(player, action), action.t !== 'endTurn');
          this.advance(undefined);
        }
      }
    } catch (e) {
      if (e instanceof GameOver) {
        this.endGame(e.winner, e.reason);
      } else {
        console.error('Engine error – rolling back action', action, e);
        if (this.actionStart && preGen) {
          // the generator is dead: roll back to the start of the whole action
          this.restore(this.actionStart);
        } else {
          this.restore(preAct);
        }
        this.gen = null;
        this.actionStart = null;
        this.actionLog = [];
        this.state.rev++;
        return { ok: false, error: 'Interní chyba – akce byla vrácena.' };
      }
    }
    this.state.rev++;
    return { ok: true };
  }

  canUndo(player: PlayerIdx): boolean {
    const st = this.state;
    return st.phase === 'play' && st.active === player && !st.pending && this.undoStack.length > 0;
  }

  canCancel(player: PlayerIdx): boolean {
    const st = this.state;
    return !!st.pending && !!this.actionStart && this.cancellable && !this.revealed && st.pending.player === player && this.actor === player;
  }

  /** Deep copy for simulations (bot). Works mid-action by replaying answers. */
  clone(): Game {
    if (!this.gen) {
      const g = new Game(structuredClone(this.state));
      g.actor = this.actor;
      return g;
    }
    const g = new Game(structuredClone(this.actionStart!));
    for (const { p, a } of this.actionLog) g.act(p, a);
    return g;
  }

  // =========================================================================
  // Action plumbing
  // =========================================================================

  private beginAction(player: PlayerIdx, action: Action, gen: Gen<unknown>, cancellable: boolean) {
    this.actionStart = structuredClone(this.state);
    this.actionStart.fx = [];
    this.actionLog = [{ p: player, a: action }];
    this.actor = player;
    this.revealed = false;
    this.cancellable = cancellable;
    this.gen = gen;
  }

  private advance(answer: Answer | undefined) {
    const st = this.state;
    let ans = answer;
    for (;;) {
      const r = this.gen!.next(ans as Answer);
      if (r.done) {
        this.gen = null;
        st.pending = null;
        this.finishAction();
        return;
      }
      st.pending = r.value;
      return;
    }
  }

  private finishAction() {
    const first = this.actionLog[0]?.a;
    if (first && (first.t === 'endTurn' || first.t === 'chooseFirst')) {
      this.undoStack = [];
    } else if (this.revealed) {
      this.undoStack = [];
    } else if (this.actionStart) {
      this.undoStack.push(this.actionStart);
      if (this.undoStack.length > 30) this.undoStack.shift();
    }
    this.actionStart = null;
    this.actionLog = [];
  }

  private restore(snap: GameState) {
    const rev = this.state.rev;
    const log = this.state.log;
    const curTotal = this.state.logTotal ?? 0;
    this.state = structuredClone(snap);
    this.state.rev = rev;
    // drop exactly the log entries added after the snapshot (robust to the log cap)
    const added = Math.max(0, curTotal - (snap.logTotal ?? 0));
    this.state.log = added > 0 ? log.slice(0, Math.max(0, log.length - added)) : log;
    this.state.logTotal = snap.logTotal;
    this.state.fx = [];
    this.state.pending = null;
  }

  private endGame(winner: PlayerIdx | 'draw', reason: string) {
    const st = this.state;
    st.phase = 'over';
    st.winner = winner;
    st.winReason = reason;
    st.pending = null;
    this.gen = null;
    this.actionStart = null;
    this.undoStack = [];
    this.log(winner === 'draw' ? null : winner, 'win', winner === 'draw' ? `Remíza! ${reason}` : `${this.pn(winner)} vítězí! ${reason}`);
  }

  // =========================================================================
  // Setup
  // =========================================================================

  private doDraftPick(p: PlayerIdx, bases: string[]): string | null {
    const st = this.state;
    if (st.phase !== 'draft') return 'Výběr základen už proběhl.';
    const pl = st.players[p];
    if (pl.draftPicked) return 'Základny už máš vybrané.';
    if (!Array.isArray(bases) || bases.length !== 3 || new Set(bases).size !== 3) return 'Vyber přesně 3 různé základny.';
    if (!bases.every((b) => pl.draftOptions.includes(b))) return 'Tuto základnu nemáš na výběr.';
    pl.draftPicked = [...bases];
    this.log(p, 'info', `${this.pn(p)} má vybrané základny.`);
    if (st.players[0].draftPicked && st.players[1].draftPicked) this.finishDraft();
    return null;
  }

  private finishDraft() {
    const st = this.state;
    for (const p of [0, 1] as PlayerIdx[]) {
      const pl = st.players[p];
      pl.bases = pl.draftPicked!.map((id) => ({ uid: `b${++st.seq}`, id, damage: 0, destroyed: false, usedTurn: -1, charge: null, stored: 0 }));
      this.log(p, 'info', `${this.pn(p)} staví základny: ${pl.bases.map((b) => cardDef(b.id).name).join(', ')}.`, pl.bases.map((b) => b.id));
    }
    for (const p of [0, 1] as PlayerIdx[]) {
      const n = st.players[p].bases.reduce((s, b) => s + (cardDef(b.id).draw ?? 0), 0);
      this.draw(p, n, true);
    }
    st.phase = 'chooseFirst';
    this.log(st.coinWinner, 'info', `Los padl na ${this.pn(st.coinWinner)} – vybírá, kdo začne.`);
  }

  // =========================================================================
  // Turn flow
  // =========================================================================

  private *startTurnGen(p: PlayerIdx): Gen {
    const st = this.state;
    st.turn++;
    st.active = p;
    st.step = 'start';
    const pl = st.players[p];
    pl.water = 0;
    this.fx({ t: 'turn', player: p });
    this.log(p, 'turn', `— Tah ${st.turn}: ${this.pn(p)} —`);

    // Start-of-turn effects: charges, stored water, traits
    const o = this.opp(p);
    for (const b of st.players[o].bases) {
      if (b.charge === p && !b.destroyed) {
        b.charge = null;
        this.fx({ t: 'boom', uid: b.uid });
        this.log(p, 'damage', `Nálož na základně ${this.nm(b.id)} vybuchla!`, [b.id]);
        yield* this.damage(b.uid, p, { kind: 'charge' });
      }
    }
    for (const col of pl.columns) {
      for (const person of col) {
        if (person.stash > 0) {
          person.stash = 0;
          this.gainWater(p, 2, `${this.nm(person.id)}: zásoba`);
        }
      }
    }
    for (const b of pl.bases) {
      if (!b.destroyed && b.stored > 0) {
        const n = b.stored;
        b.stored = 0;
        this.gainWater(p, n, `${this.nm(b.id)}: uložená voda`);
      }
    }
    if (pl.bases.some((b) => b.id === 'studna' && !b.destroyed && b.damage === 0)) this.gainWater(p, 1, 'Studna');
    const barons = this.activePeople(p).filter((x) => x.id === 'baron').length;
    if (barons > 0) this.gainWater(p, barons, 'Vodní baron');
    const ludmily = this.activePeople(p).filter((x) => x.id === 'ludmila').length;
    if (ludmily > 0 && pl.queue.every((q) => q === null)) {
      this.log(p, 'draw', `Starostka Ludmila: prázdná fronta, ${this.pn(p)} líže.`);
      this.draw(p, ludmily);
    }

    // Events phase
    st.step = 'events';
    const ev = pl.queue[0];
    if (ev) {
      pl.queue[0] = null;
      yield* this.resolveEvent(p, ev);
    }
    if (pl.queue[0] === null) {
      pl.queue[0] = pl.queue[1];
      pl.queue[1] = pl.queue[2];
      pl.queue[2] = null;
    }

    // Replenish
    st.step = 'replenish';
    const base = st.turn === 1 ? 1 : 3;
    const gain = Math.max(0, base - pl.waterPenalty);
    if (pl.waterPenalty > 0) this.log(p, 'water', `Sucho: ${this.pn(p)} dostává o ${pl.waterPenalty} vody méně.`);
    pl.waterPenalty = 0;
    pl.water += gain;
    this.fx({ t: 'water', player: p, n: gain });
    this.draw(p, 1);
    st.step = 'actions';
  }

  private *runAction(p: PlayerIdx, a: Action): Gen {
    const st = this.state;
    const pl = st.players[p];
    switch (a.t) {
      case 'playPerson': {
        const inst = this.takeFromHand(p, a.uid);
        const def = cardDef(inst.id);
        const cost = this.personCost(p, def);
        if (this.baseTraitActive(p, 'kantyna') && pl.personDiscountTurn !== st.turn && (def.cost ?? 0) > 0) pl.personDiscountTurn = st.turn;
        pl.water -= cost;
        let col = a.col;
        let pos = a.pos;
        if (col === undefined || pos === undefined || !this.slotValid(p, col, pos)) {
          const slot = yield* this.chooseSlot(p, 'Kam postavíš přeživšího?', inst.id);
          if (!slot) return;
          col = slot.col;
          pos = slot.pos;
        }
        const person: PersonInPlay = {
          uid: inst.uid, id: inst.id, faceDown: false, damaged: false,
          playedTurn: st.turn, usedTurn: -1, restoredTurn: -1, stunnedTurn: -1, stash: 0,
        };
        this.placePerson(p, person, col, pos);
        this.fx({ t: 'play', uid: inst.uid, player: p });
        this.log(p, 'play', `${this.pn(p)} verbuje ${def.name} (${COL_NAME[col]} sloupec, cena ${cost}).`, [inst.id]);
        return;
      }
      case 'playEvent': {
        const inst = this.takeFromHand(p, a.uid);
        const def = cardDef(inst.id);
        pl.water -= def.cost ?? 0;
        this.fx({ t: 'event', uid: inst.uid, player: p, id: inst.id });
        if ((def.countdown ?? 0) === 0) {
          this.revealed = true;
          this.log(p, 'event', `${this.pn(p)} spouští operaci ${def.name}.`, [inst.id]);
          yield* this.resolveEvent(p, inst);
          return;
        }
        const idx = this.eventSlotFor(p, def.countdown!);
        pl.queue[idx] = inst;
        this.log(p, 'event', `${this.pn(p)} plánuje operaci ${def.name} (místo ${idx + 1}).`, [inst.id]);
        return;
      }
      case 'junk': {
        const inst = this.takeFromHand(p, a.uid);
        const def = cardDef(inst.id);
        // the junked card is shown to the opponent -> no cancel/undo afterwards
        if (inst.id !== 'cisterna') this.revealed = true;
        if (inst.id === 'cisterna') pl.cisternHome = true;
        else this.discardOf(p).push(inst);
        this.fx({ t: 'junk', player: p, id: inst.id });
        this.log(p, 'play', `${this.pn(p)} rozebírá ${def.name} → ${JUNK_LABEL[def.junk!]}.`, [inst.id]);
        yield* this.junkEffect(p, def.junk!, inst.uid);
        return;
      }
      case 'drawCard': {
        const cost = this.drawCost(p);
        if (cost < 2) pl.drawDiscountTurn = st.turn;
        pl.water -= cost;
        this.log(p, 'draw', `${this.pn(p)} platí ${cost} vody a líže kartu.`);
        this.draw(p, 1);
        return;
      }
      case 'takeCistern': {
        pl.water -= 1;
        pl.cisternHome = false;
        pl.hand.push({ uid: `w${++st.seq}`, id: 'cisterna' });
        this.log(p, 'water', `${this.pn(p)} bere Cisternu do ruky.`, ['cisterna']);
        return;
      }
      case 'ability': {
        const ctx: Ctx = { p, uid: a.uid };
        const pl2 = this.findPerson(a.uid);
        const def = cardDef(pl2 ? pl2.person.id : this.findBase(a.uid)!.base.id);
        const ab = def.abilities[a.idx];
        pl.water -= this.abilityCost(p, ab.cost);
        if (pl2) pl2.person.usedTurn = st.turn;
        else this.findBase(a.uid)!.base.usedTurn = st.turn;
        this.fx({ t: 'ability', uid: a.uid, player: p });
        this.log(p, 'play', `${this.pn(p)} používá ${def.name}: ${ab.text}`, [def.id]);
        yield* ab.run(this, ctx);
        return;
      }
      case 'endTurn': {
        this.log(p, 'turn', `${this.pn(p)} končí tah.`);
        pl.water = 0;
        yield* this.startTurnGen(this.opp(p));
        return;
      }
      default:
        throw new Error(`Unhandled action ${(a as Action).t}`);
    }
  }

  // =========================================================================
  // Legality
  // =========================================================================

  checkAction(p: PlayerIdx, a: Action): string | null {
    const st = this.state;
    if (st.phase !== 'play') return 'Hra ještě nezačala.';
    if (st.active !== p) return 'Nejsi na tahu.';
    if (st.pending) return 'Nejdřív dokonči rozhodnutí.';
    if (st.step !== 'actions') return 'Teď nelze provádět akce.';
    const pl = st.players[p];
    switch (a.t) {
      case 'playPerson': {
        const c = pl.hand.find((h) => h.uid === a.uid);
        if (!c) return 'Karta není v ruce.';
        const def = cardDef(c.id);
        if (def.kind !== 'survivor') return 'To není přeživší.';
        if (this.personCost(p, def) > pl.water) return 'Nemáš dost vody.';
        if (!this.hasFreeSlot(p)) return 'Nemáš volné místo (max. 6 přeživších).';
        if ((a.col !== undefined || a.pos !== undefined) && !this.slotValid(p, a.col as number, a.pos as string)) return 'Na toto místo nelze hrát.';
        return null;
      }
      case 'playEvent': {
        const c = pl.hand.find((h) => h.uid === a.uid);
        if (!c) return 'Karta není v ruce.';
        const def = cardDef(c.id);
        if (def.kind !== 'operation') return 'To není operace.';
        if ((def.cost ?? 0) > pl.water) return 'Nemáš dost vody.';
        if ((def.countdown ?? 0) > 0 && this.eventSlotFor(p, def.countdown!) < 0) return 'Ve frontě není volné místo.';
        if (def.canPlay && !def.canPlay(this, { p, uid: c.uid })) return def.playNeeds ?? 'Operaci teď nelze zahrát.';
        return null;
      }
      case 'junk': {
        if (!pl.hand.some((h) => h.uid === a.uid)) return 'Karta není v ruce.';
        return null;
      }
      case 'drawCard':
        return this.drawCost(p) <= pl.water ? null : 'Nemáš dost vody.';
      case 'takeCistern':
        if (!pl.cisternHome) return 'Cisternu už máš v ruce.';
        return pl.water >= 1 ? null : 'Nemáš dost vody.';
      case 'ability': {
        const pp = this.findPerson(a.uid);
        const bb = pp ? null : this.findBase(a.uid);
        if (pp) {
          if (pp.owner !== p) return 'To není tvoje karta.';
          if (pp.person.faceDown) return 'Tulák nemá schopnosti.';
          if (!this.isPersonReady(pp.person)) return 'Karta není připravená.';
        } else if (bb) {
          if (bb.owner !== p) return 'To není tvoje karta.';
          if (!this.isBaseReady(bb.base)) return bb.base.destroyed ? 'Základna je zničená.' : 'Základna už byla v tomto tahu použita.';
        } else return 'Karta nenalezena.';
        const def = cardDef(pp ? pp.person.id : bb!.base.id);
        const ab = def.abilities[a.idx];
        if (!Number.isInteger(a.idx) || a.idx < 0 || a.idx >= def.abilities.length || !ab) return 'Karta takovou schopnost nemá.';
        if (this.abilityCost(p, ab.cost) > pl.water) return 'Nemáš dost vody.';
        if (ab.canUse && !ab.canUse(this, { p, uid: a.uid })) {
          const n = ab.needs;
          return typeof n === 'function' ? n(this, { p, uid: a.uid }) : n ?? 'Schopnost teď nemá platný cíl.';
        }
        return null;
      }
      case 'endTurn':
        return null;
      default:
        return 'Neznámá akce.';
    }
  }

  legalInfo(p: PlayerIdx): LegalInfo {
    const st = this.state;
    const pl = st.players[p];
    const info: LegalInfo = {
      playable: [], junkable: [], abilities: [], blocked: {}, canDraw: false, drawCost: this.drawCost(p),
      canTakeCistern: false, canEndTurn: false, personCost: {},
    };
    for (const c of pl.hand) {
      const def = cardDef(c.id);
      if (def.kind === 'survivor') info.personCost[c.uid] = this.personCost(p, def);
    }
    const myTurn = st.phase === 'play' && st.active === p && !st.pending && st.step === 'actions';
    if (!myTurn) return info;
    info.canEndTurn = true;
    for (const c of pl.hand) {
      const def = cardDef(c.id);
      const play: Action | null = def.kind === 'survivor' ? { t: 'playPerson', uid: c.uid } : def.kind === 'operation' ? { t: 'playEvent', uid: c.uid } : null;
      if (play) {
        const err = this.checkAction(p, play);
        if (!err) info.playable.push(c.uid);
        else info.blocked[c.uid] = err;
      }
      info.junkable.push(c.uid);
    }
    info.canDraw = !this.checkAction(p, { t: 'drawCard' });
    info.canTakeCistern = !this.checkAction(p, { t: 'takeCistern' });
    const sources: { uid: string; id: string }[] = [
      ...pl.columns.flat().filter((x) => !x.faceDown).map((x) => ({ uid: x.uid, id: x.id })),
      ...pl.bases.filter((b) => !b.destroyed).map((b) => ({ uid: b.uid, id: b.id })),
    ];
    for (const s of sources) {
      cardDef(s.id).abilities.forEach((_, idx) => {
        const err = this.checkAction(p, { t: 'ability', uid: s.uid, idx });
        if (!err) info.abilities.push({ uid: s.uid, idx });
        else info.blocked[`${s.uid}:${idx}`] = err;
      });
    }
    return info;
  }

  /** All legal top-level actions (for bots / tests). */
  legalActions(p: PlayerIdx): Action[] {
    const st = this.state;
    const out: Action[] = [];
    if (st.phase === 'chooseFirst' && st.coinWinner === p) return [{ t: 'chooseFirst', first: p }, { t: 'chooseFirst', first: this.opp(p) }];
    const info = this.legalInfo(p);
    if (!info.canEndTurn) return out;
    const pl = st.players[p];
    for (const uid of info.playable) {
      const c = pl.hand.find((h) => h.uid === uid)!;
      out.push(cardDef(c.id).kind === 'survivor' ? { t: 'playPerson', uid } : { t: 'playEvent', uid });
    }
    for (const uid of info.junkable) out.push({ t: 'junk', uid });
    if (info.canDraw) out.push({ t: 'drawCard' });
    if (info.canTakeCistern) out.push({ t: 'takeCistern' });
    for (const ab of info.abilities) out.push({ t: 'ability', uid: ab.uid, idx: ab.idx });
    out.push({ t: 'endTurn' });
    return out;
  }

  // =========================================================================
  // Queries
  // =========================================================================

  opp(p: PlayerIdx): PlayerIdx {
    return (1 - p) as PlayerIdx;
  }

  pn(p: PlayerIdx): string {
    return this.state.players[p].name;
  }

  nm(id: string): string {
    return CARDS[id]?.name ?? id;
  }

  handSize(p: PlayerIdx): number {
    return this.state.players[p].hand.length;
  }

  peopleCount(p: PlayerIdx): number {
    return this.state.players[p].columns.reduce((s, c) => s + c.length, 0);
  }

  hasFreeSlot(p: PlayerIdx): boolean {
    return this.state.players[p].columns.some((c) => c.length < 2);
  }

  findPerson(uid: string): PersonLoc | null {
    for (const owner of [0, 1] as PlayerIdx[]) {
      const cols = this.state.players[owner].columns;
      for (let col = 0; col < cols.length; col++) {
        const idx = cols[col].findIndex((x) => x.uid === uid);
        if (idx >= 0) return { owner, col, idx, person: cols[col][idx] };
      }
    }
    return null;
  }

  findBase(uid: string): BaseLoc | null {
    for (const owner of [0, 1] as PlayerIdx[]) {
      const col = this.state.players[owner].bases.findIndex((b) => b.uid === uid);
      if (col >= 0) return { owner, col, base: this.state.players[owner].bases[col] };
    }
    return null;
  }

  isPersonReady(x: PersonInPlay): boolean {
    const t = this.state.turn;
    return !x.faceDown && !x.damaged && x.playedTurn !== t && x.usedTurn !== t && x.restoredTurn !== t && x.stunnedTurn !== t;
  }

  /** Why a person is not ready (for UI). */
  notReadyReason(x: PersonInPlay): string | null {
    const t = this.state.turn;
    if (x.faceDown) return 'Tulák nemá schopnosti';
    if (x.damaged) return 'Poškozený';
    if (x.stunnedTurn === t) return 'Omráčený';
    if (x.playedTurn === t) return 'Zahrán v tomto tahu';
    if (x.restoredTurn === t) return 'Opraven v tomto tahu';
    if (x.usedTurn === t) return 'Schopnost už použita';
    return null;
  }

  isBaseReady(b: BaseInPlay): boolean {
    return !b.destroyed && b.usedTurn !== this.state.turn;
  }

  isExposed(owner: PlayerIdx, col: number): boolean {
    return this.state.players[owner].exposedTurn[col] === this.state.turn;
  }

  isUnprotected(uid: string): boolean {
    const pp = this.findPerson(uid);
    if (pp) {
      const column = this.state.players[pp.owner].columns[pp.col];
      return pp.idx === column.length - 1 || this.isExposed(pp.owner, pp.col);
    }
    const bb = this.findBase(uid);
    if (bb) return this.state.players[bb.owner].columns[bb.col].length === 0 || this.isExposed(bb.owner, bb.col);
    return false;
  }

  activePeople(p: PlayerIdx): PersonInPlay[] {
    return this.state.players[p].columns.flat().filter((x) => !x.faceDown && !x.damaged);
  }

  baseTraitActive(p: PlayerIdx, id: string): boolean {
    return this.state.players[p].bases.some((b) => b.id === id && !b.destroyed);
  }

  /** Strážce studny protects his column's base from raids. */
  raidGuarded(owner: PlayerIdx, col: number): boolean {
    return this.state.players[owner].columns[col].some((x) => !x.faceDown && !x.damaged && x.id === 'strazce');
  }

  /** Bedřich's trait: undamaged Bedřich ignores injure. */
  bedrichShield(x: PersonInPlay): boolean {
    return !x.faceDown && !x.damaged && x.id === 'bedrich';
  }

  bunkerImmune(owner: PlayerIdx, col: number): boolean {
    const b = this.state.players[owner].bases[col];
    return b.id === 'bunkr' && !b.destroyed && this.state.players[owner].columns[col].length >= 2;
  }

  personCost(p: PlayerIdx, def: CardDef): number {
    const pl = this.state.players[p];
    let c = def.cost ?? 0;
    if (c > 0 && this.baseTraitActive(p, 'kantyna') && pl.personDiscountTurn !== this.state.turn) c -= 1;
    return Math.max(0, c);
  }

  drawCost(p: PlayerIdx): number {
    const pl = this.state.players[p];
    return this.baseTraitActive(p, 'stezka') && pl.drawDiscountTurn !== this.state.turn ? 1 : 2;
  }

  abilityCost(_p: PlayerIdx, base: number): number {
    return base;
  }

  eventSlotFor(p: PlayerIdx, countdown: number): number {
    const pl = this.state.players[p];
    let cd = countdown;
    if (this.baseTraitActive(p, 'vysilac')) cd = Math.max(1, cd - 1);
    for (let s = cd; s <= 3; s++) if (pl.queue[s - 1] === null) return s - 1;
    return -1;
  }

  slotValid(p: PlayerIdx, col: number, pos: string): boolean {
    if (!Number.isInteger(col) || col < 0 || col > 2) return false;
    if (pos !== 'back' && pos !== 'front' && pos !== 'only') return false;
    const column = this.state.players[p].columns[col];
    if (!column) return false;
    if (column.length === 0) return pos === 'only' || pos === 'front' || pos === 'back';
    if (column.length === 1) return pos === 'front' || pos === 'back';
    return false;
  }

  // ---- target lists ----

  damageTargets(p: PlayerIdx, kind: 'damage' | 'injure'): string[] {
    const o = this.opp(p);
    const op = this.state.players[o];
    const out: string[] = [];
    op.columns.forEach((column, col) => {
      column.forEach((x, idx) => {
        const unprot = idx === column.length - 1 || this.isExposed(o, col);
        if (!unprot) return;
        if (kind === 'injure' && this.bedrichShield(x)) return;
        out.push(x.uid);
      });
    });
    if (kind === 'damage') {
      op.bases.forEach((b, col) => {
        if (b.destroyed) return;
        if (op.columns[col].length > 0 && !this.isExposed(o, col)) return;
        if (this.bunkerImmune(o, col)) return;
        out.push(b.uid);
      });
    }
    return out;
  }

  hasDamageTarget(p: PlayerIdx, kind: 'damage' | 'injure'): boolean {
    return this.damageTargets(p, kind).length > 0;
  }

  exposableColumns(p: PlayerIdx): number[] {
    const o = this.opp(p);
    return [0, 1, 2].filter((c) => this.state.players[o].columns[c].length > 0 && !this.isExposed(o, c));
  }

  chargeTargets(p: PlayerIdx): string[] {
    const o = this.opp(p);
    const op = this.state.players[o];
    return op.bases.filter((b, col) => !b.destroyed && b.charge === null && (op.columns[col].length === 0 || this.isExposed(o, col))).map((b) => b.uid);
  }

  restoreTargets(p: PlayerIdx, o: { basesOnly?: boolean; exclude?: string }): string[] {
    const pl = this.state.players[p];
    const out: string[] = [];
    if (!o.basesOnly) for (const x of pl.columns.flat()) if (x.damaged && !x.faceDown && x.uid !== o.exclude) out.push(x.uid);
    for (const b of pl.bases) if (!b.destroyed && (b.damage > 0 || (b.charge !== null && b.charge !== p)) && b.uid !== o.exclude) out.push(b.uid);
    return out;
  }

  stunTargets(p: PlayerIdx): string[] {
    const o = this.opp(p);
    const out: string[] = [];
    this.state.players[o].columns.forEach((column, col) => {
      column.forEach((x, idx) => {
        const unprot = idx === column.length - 1 || this.isExposed(o, col);
        if (unprot && !x.faceDown && x.stunnedTurn !== this.state.turn + 1) out.push(x.uid);
      });
    });
    return out;
  }

  usedBases(p: PlayerIdx): string[] {
    const t = this.state.turn;
    return this.state.players[p].bases.filter((b) => !b.destroyed && b.usedTurn === t && cardDef(b.id).abilities.length > 0).map((b) => b.uid);
  }

  usedPeople(p: PlayerIdx, exclude: string): string[] {
    const t = this.state.turn;
    return this.state.players[p].columns.flat()
      .filter((x) => !x.faceDown && !x.damaged && x.usedTurn === t && x.uid !== exclude && x.stunnedTurn !== t && x.playedTurn !== t && x.restoredTurn !== t)
      .filter((x) => cardDef(x.id).abilities.some((ab) => !ab.canUse || ab.canUse(this, { p, uid: x.uid })))
      .map((x) => x.uid);
  }

  advanceableEvents(p: PlayerIdx): string[] {
    const q = this.state.players[p].queue;
    const out: string[] = [];
    q.forEach((e, i) => {
      if (e && (i === 0 || q[i - 1] === null)) out.push(e.uid);
    });
    return out;
  }

  swappableEnemyColumns(p: PlayerIdx): number[] {
    const o = this.opp(p);
    return [0, 1, 2].filter((c) => this.state.players[o].columns[c].length === 2);
  }

  backlineTargets(p: PlayerIdx): string[] {
    const o = this.opp(p);
    const out: string[] = [];
    this.state.players[o].columns.forEach((column) => {
      if (column.length === 2) {
        const x = column[0];
        if (!this.bedrichShield(x)) out.push(x.uid);
      }
    });
    return out;
  }

  damagedEnemies(p: PlayerIdx): string[] {
    return this.state.players[this.opp(p)].columns.flat().filter((x) => x.damaged).map((x) => x.uid);
  }

  opponentEvents(p: PlayerIdx): string[] {
    return this.state.players[this.opp(p)].queue.filter((e): e is CardInst => !!e).map((e) => e.uid);
  }

  ownFaceUpPeople(p: PlayerIdx, undamagedOnly = false): string[] {
    return this.state.players[p].columns.flat().filter((x) => !x.faceDown && (!undamagedOnly || !x.damaged)).map((x) => x.uid);
  }

  discardableHand(p: PlayerIdx): CardInst[] {
    return this.state.players[p].hand.filter((h) => h.id !== 'cisterna');
  }

  drifterTargets(p: PlayerIdx): string[] {
    return this.damageTargets(p, 'injure').filter((uid) => this.findPerson(uid)?.person.faceDown);
  }

  bedrichMoves(c: Ctx): number[] {
    const loc = this.findPerson(c.uid);
    if (!loc) return [];
    return [0, 1, 2].filter((col) => col !== loc.col && this.state.players[c.p].columns[col].length < 2);
  }

  canRaid(p: PlayerIdx): boolean {
    const pl = this.state.players[p];
    if (pl.raidHome) return this.eventSlotFor(p, RAID.countdown!) >= 0;
    const k = pl.queue.findIndex((e) => e?.id === 'najezd');
    return k === 0 || (k > 0 && pl.queue[k - 1] === null);
  }

  // =========================================================================
  // Prompts
  // =========================================================================

  *pick(player: PlayerIdx, title: string, options: PromptOption[], o: { optional?: boolean; reveal?: CardInst[]; sourceUid?: string; kind?: PromptKind; min?: number; max?: number } = {}): Gen<string | null> {
    if (options.length === 0) return null;
    // Opponent-side decisions with a single possible answer are resolved automatically.
    if (options.length === 1 && !o.optional && player !== this.actor && (o.kind ?? 'pick') === 'pick') {
      return options[0].id;
    }
    const ans = yield* this.ask(player, o.kind ?? 'pick', title, options, o);
    return ans[0] ?? null;
  }

  *ask(player: PlayerIdx, kind: PromptKind, title: string, options: PromptOption[], o: { optional?: boolean; reveal?: CardInst[]; sourceUid?: string; min?: number; max?: number } = {}): Gen<Answer> {
    const st = this.state;
    if (player !== this.actor) this.revealed = true;
    const prompt: Prompt = { id: ++st.promptSeq, player, kind, title, options, optional: o.optional, reveal: o.reveal, sourceUid: o.sourceUid, min: o.min, max: o.max };
    const ans: Answer = yield prompt;
    return ans;
  }

  refLabel(uid: string): string {
    const pp = this.findPerson(uid);
    if (pp) {
      const column = this.state.players[pp.owner].columns[pp.col];
      const where = column.length === 1 ? '' : pp.idx === column.length - 1 ? ', vepředu' : ', vzadu';
      const name = pp.person.faceDown ? 'Tulák' : this.nm(pp.person.id);
      return `${name}${pp.person.damaged ? ' (poškozený)' : ''} – ${COL_NAME[pp.col]} sloupec${where}`;
    }
    const bb = this.findBase(uid);
    if (bb) return `${this.nm(bb.base.id)}${bb.base.damage > 0 ? ' (poškozená)' : ''} – základna`;
    const ev = this.findEvent(uid);
    if (ev) return `${this.nm(ev.inst.id)} (místo ${ev.slot + 1})`;
    return uid;
  }

  private findEvent(uid: string): { owner: PlayerIdx; slot: number; inst: CardInst } | null {
    for (const owner of [0, 1] as PlayerIdx[]) {
      const slot = this.state.players[owner].queue.findIndex((e) => e?.uid === uid);
      if (slot >= 0) return { owner, slot, inst: this.state.players[owner].queue[slot]! };
    }
    return null;
  }

  private cardOptions(uids: string[], tone: 'danger' | 'good' | 'neutral' = 'neutral'): PromptOption[] {
    return uids.map((uid) => {
      const isPerson = !!this.findPerson(uid);
      const isBase = !isPerson && !!this.findBase(uid);
      return { id: uid, label: this.refLabel(uid), ref: isPerson ? { t: 'person', uid } : isBase ? { t: 'base', uid } : { t: 'event', uid }, tone };
    });
  }

  *chooseSlot(p: PlayerIdx, title: string, cardId?: string): Gen<{ col: number; pos: 'back' | 'front' | 'only' } | null> {
    const opts: PromptOption[] = [];
    this.state.players[p].columns.forEach((column, col) => {
      if (column.length === 0) opts.push({ id: `${col}:only`, label: `${COL_NAME[col]} sloupec`, ref: { t: 'slot', player: p, col, pos: 'only' } });
      else if (column.length === 1) {
        opts.push({ id: `${col}:front`, label: `${COL_NAME[col]} sloupec – vepředu (bude krýt)`, ref: { t: 'slot', player: p, col, pos: 'front' } });
        opts.push({ id: `${col}:back`, label: `${COL_NAME[col]} sloupec – vzadu (bude krytý)`, ref: { t: 'slot', player: p, col, pos: 'back' } });
      }
    });
    const id = yield* this.pick(p, title, opts, { reveal: cardId ? [{ uid: 'preview', id: cardId }] : undefined });
    if (!id) return null;
    const [c, pos] = id.split(':');
    return { col: Number(c), pos: pos as 'back' | 'front' | 'only' };
  }

  private placePerson(p: PlayerIdx, person: PersonInPlay, col: number, pos: 'back' | 'front' | 'only') {
    const column = this.state.players[p].columns[col];
    if (pos === 'back') column.unshift(person);
    else column.push(person);
  }

  // =========================================================================
  // Effects
  // =========================================================================

  fx(f: Fx) {
    this.state.fx.push(f);
  }

  log(player: PlayerIdx | null, kind: LogKind, text: string, cards?: string[], priv?: LogEntry['priv']) {
    this.state.logTotal = (this.state.logTotal ?? 0) + 1;
    this.state.log.push({ turn: this.state.turn, player, kind, text, cards, priv });
    if (this.state.log.length > 400) this.state.log.splice(0, this.state.log.length - 400);
  }

  private freshUid(prefix = 'c'): string {
    return `${prefix}${++this.state.seq}`;
  }

  /** Draw pile used by player p (shared in classic mode). */
  deckOf(p: PlayerIdx): CardInst[] {
    return this.state.opts.personal ? this.state.players[p].deck! : this.state.deck;
  }

  /** Discard pile used by player p (shared in classic mode). */
  discardOf(p: PlayerIdx): CardInst[] {
    return this.state.opts.personal ? this.state.players[p].discard! : this.state.discard;
  }

  /** Can player p still take a card from their deck (possibly after the one allowed reshuffle)? */
  canDrawMore(p: PlayerIdx): boolean {
    const st = this.state;
    const resh = st.opts.personal ? st.players[p].reshuffles ?? 0 : st.reshuffles;
    return this.deckOf(p).length > 0 || (resh === 0 && this.discardOf(p).length > 0);
  }

  private drawTop(p: PlayerIdx): CardInst {
    const st = this.state;
    const deck = this.deckOf(p);
    if (deck.length === 0) {
      const discard = this.discardOf(p);
      const personal = !!st.opts.personal;
      const resh = personal ? st.players[p].reshuffles ?? 0 : st.reshuffles;
      if (resh === 0 && discard.length > 0) {
        deck.push(...discard.map((c) => ({ uid: this.freshUid(), id: c.id })));
        discard.length = 0;
        shuffleInPlace(st.rng, deck);
        if (personal) st.players[p].reshuffles = 1;
        else st.reshuffles = 1;
        this.revealed = true;
        this.log(personal ? p : null, 'info', personal
          ? `${this.pn(p)}: balíček došel – odhozené karty se zamíchaly zpět. Až dojde podruhé, ${this.pn(p)} prohrává vyčerpáním.`
          : 'Balíček došel – odhazovací balíček se zamíchal jako nový balíček. Až dojde podruhé, hra končí remízou.');
      } else if (personal) {
        throw new GameOver(this.opp(p), `${this.pn(p)} došly karty (vyčerpání).`);
      } else {
        throw new GameOver('draw', resh === 0 ? 'Došly všechny karty v balíčku i v odhazovacím balíčku.' : 'Balíček došel podruhé.');
      }
    }
    return deck.shift()!;
  }

  draw(p: PlayerIdx, n: number, silent = false) {
    if (n <= 0) return;
    const pl = this.state.players[p];
    const got: string[] = [];
    for (let i = 0; i < n; i++) {
      const c = this.drawTop(p);
      pl.hand.push(c);
      got.push(c.id);
    }
    this.revealed = true;
    this.fx({ t: 'draw', player: p, n });
    if (!silent) {
      this.log(p, 'draw', `${this.pn(p)} líže ${n === 1 ? 'kartu' : `${n} karty`}.`, undefined, {
        player: p, text: `Líznul(a) sis: ${got.map((id) => this.nm(id)).join(', ')}.`,
      });
    } else {
      this.log(p, 'draw', `${this.pn(p)} si bere do ruky ${n} karet.`, undefined, { player: p, text: `Do ruky sis vzal(a): ${got.map((id) => this.nm(id)).join(', ')}.` });
    }
  }

  gainWater(p: PlayerIdx, n: number, why?: string) {
    this.state.players[p].water += n;
    this.fx({ t: 'water', player: p, n });
    this.log(p, 'water', `${this.pn(p)} získává ${n} ${n === 1 ? 'vodu' : 'vody'} navíc${why ? ` (${why})` : ''}.`);
  }

  private takeFromHand(p: PlayerIdx, uid: string): CardInst {
    const hand = this.state.players[p].hand;
    const i = hand.findIndex((h) => h.uid === uid);
    if (i < 0) throw new Error('card not in hand');
    return hand.splice(i, 1)[0];
  }

  *junkEffect(p: PlayerIdx, kind: JunkKind, srcUid: string): Gen {
    const ctx: Ctx = { p, uid: srcUid };
    switch (kind) {
      case 'raid': yield* this.raid(p); break;
      case 'injure': yield* this.damageChoose(ctx, { kind: 'injure' }); break;
      case 'restore': yield* this.restoreChoose(ctx, {}); break;
      case 'draw': this.draw(p, 1); break;
      case 'drifter': yield* this.gainDrifter(p); break;
      case 'water': this.gainWater(p, 1); break;
    }
  }

  *damageChoose(c: Ctx, o: { kind: 'damage' | 'injure'; title?: string; optional?: boolean }): Gen<DamageResult | null> {
    const targets = this.damageTargets(c.p, o.kind);
    if (targets.length === 0) {
      this.log(c.p, 'info', 'Žádný platný cíl.');
      return null;
    }
    const title = o.title ?? (o.kind === 'injure' ? 'Vyber nekrytého nepřítele ke zranění' : 'Vyber nekrytou kartu soupeře k poškození');
    const uid = yield* this.pick(c.p, title, this.cardOptions(targets, 'danger'), { optional: o.optional, sourceUid: c.uid });
    if (!uid) return null;
    const srcIsPerson = !!this.findPerson(c.uid) && this.findPerson(c.uid)!.owner === c.p;
    return yield* this.damage(uid, c.p, { kind: o.kind, srcUid: c.uid, srcIsPerson });
  }

  /** Apply one damage to a card (person or base). Ignores protection – callers choose legal targets. */
  *damage(uid: string, by: PlayerIdx, o: { kind: DmgKind; srcUid?: string; srcIsPerson?: boolean }): Gen<DamageResult | null> {
    const st = this.state;
    const pp = this.findPerson(uid);
    if (pp) {
      const { owner, col, person } = pp;
      if (o.kind === 'injure' && this.bedrichShield(person)) {
        this.log(owner, 'info', 'Bedřich Pancéř zranění ignoruje.');
        return null;
      }
      const res: DamageResult = { uid, owner, kind: 'person', col, destroyed: false, destroyedPerson: false };
      const tough = person.faceDown && !person.damaged && this.activePeople(owner).some((x) => x.id === 'matka');
      const src = o.srcUid ?? (o.kind === 'raid' ? `raidtok-${by}` : undefined);
      if (tough) {
        person.damaged = true;
        this.fx({ t: 'damage', uid, src });
        this.log(by, 'damage', `Tulák (${this.pn(owner)}) vydržel zásah – chrání ho Matka Prachu.`);
      } else if (person.faceDown || person.damaged) {
        this.fx({ t: 'damage', uid, destroyed: true, src });
        yield* this.destroyPerson(uid, by);
        res.destroyed = true;
        res.destroyedPerson = true;
      } else {
        person.damaged = true;
        this.fx({ t: 'damage', uid, src });
        this.log(by, 'damage', `${this.nm(person.id)} (${this.pn(owner)}) je poškozen(a).`, [person.id]);
      }
      if (owner !== by) yield* this.sentryCheck(owner, col, uid, by);
      return res;
    }
    const bb = this.findBase(uid);
    if (!bb) return null;
    const { owner, col, base } = bb;
    if (base.destroyed) return null;
    if (this.bunkerImmune(owner, col)) {
      this.log(owner, 'info', 'Bunkr odolal – jeho sloupec je plný.');
      return null;
    }
    const hp = cardDef(base.id).hp ?? 2;
    const bsrc = o.srcUid ?? (o.kind === 'raid' ? `raidtok-${by}` : undefined);
    base.damage++;
    const res: DamageResult = { uid, owner, kind: 'base', col, destroyed: false, destroyedPerson: false };
    if (base.damage >= hp) {
      base.destroyed = true;
      base.charge = null;
      base.stored = 0;
      res.destroyed = true;
      this.fx({ t: 'damage', uid, destroyed: true, src: bsrc });
      this.log(by, 'destroy', `Základna ${this.nm(base.id)} (${this.pn(owner)}) je ZNIČENA!`, [base.id]);
      this.checkWin();
    } else {
      this.fx({ t: 'damage', uid, src: bsrc });
      this.log(by, 'damage', `Základna ${this.nm(base.id)} (${this.pn(owner)}) je poškozena${hp > 2 ? ` (${base.damage}/${hp - 1})` : ''}.`, [base.id]);
    }
    // Minové pole retaliation
    if (base.id === 'minovepole' && o.srcIsPerson && o.srcUid && owner !== by) {
      const src = this.findPerson(o.srcUid);
      if (src && src.owner === by) {
        this.log(owner, 'damage', `Minové pole: ${this.nm(src.person.id)} šlápl(a) na minu!`);
        yield* this.damage(o.srcUid, owner, { kind: 'injure' });
      }
    }
    if (owner !== by) yield* this.sentryCheck(owner, col, uid, by);
    return res;
  }

  private *sentryCheck(owner: PlayerIdx, col: number, targetUid: string, by: PlayerIdx): Gen {
    const st = this.state;
    const pl = st.players[owner];
    if (pl.sentryTurn === st.turn) return;
    const sentry = pl.columns[col]?.find((x) => !x.faceDown && x.id === 'hlidkar' && !x.damaged && x.uid !== targetUid);
    if (!sentry) return;
    const targets = this.damageTargets(owner, 'injure');
    if (targets.length === 0) return;
    const uid = yield* this.pick(owner, 'Hlídkař: můžeš zranit nekrytého nepřítele (odveta)', this.cardOptions(targets, 'danger'), { optional: true, sourceUid: sentry.uid });
    if (!uid) return;
    pl.sentryTurn = st.turn;
    this.log(owner, 'damage', `Hlídkař (${this.pn(owner)}) oplácí palbu!`, ['hlidkar']);
    yield* this.damage(uid, owner, { kind: 'injure', srcUid: sentry.uid, srcIsPerson: true });
  }

  *destroyPerson(uid: string, by: PlayerIdx): Gen {
    const st = this.state;
    const loc = this.findPerson(uid);
    if (!loc) return;
    const { owner, col, idx, person } = loc;
    st.players[owner].columns[col].splice(idx, 1);
    if (person.faceDown) {
      this.deckOf(owner).unshift({ uid: this.freshUid(), id: person.id });
      this.log(by, 'destroy', `Tulák (${this.pn(owner)}) je zničen a vrací se lícem dolů na balíček.`);
    } else {
      this.discardOf(owner).push({ uid: person.uid, id: person.id });
      this.log(by, 'destroy', `${this.nm(person.id)} (${this.pn(owner)}) je zničen(a).`, [person.id]);
      if (person.id === 'rex') {
        this.log(owner, 'info', 'Pes Rex: věrný až do konce – přichází tulák.');
        yield* this.gainDrifter(owner);
      }
    }
  }

  private checkWin() {
    for (const p of [0, 1] as PlayerIdx[]) {
      const pl = this.state.players[p];
      if (pl.bases.length === 3 && pl.bases.every((b) => b.destroyed)) {
        throw new GameOver(this.opp(p), `Všechny základny hráče ${this.pn(p)} padly.`);
      }
    }
  }

  *restoreChoose(c: Ctx, o: { keepReady?: boolean; basesOnly?: boolean; exclude?: string; optional?: boolean }): Gen {
    const targets = this.restoreTargets(c.p, o);
    if (targets.length === 0) {
      this.log(c.p, 'info', 'Není co opravit.');
      return;
    }
    const uid = yield* this.pick(c.p, o.optional ? 'Můžeš opravit ještě jednu kartu' : 'Vyber svou kartu k opravě', this.cardOptions(targets, 'good'), { sourceUid: c.uid, optional: o.optional });
    if (uid) this.restoreCard(uid, !!o.keepReady);
  }

  restoreCard(uid: string, keepReady: boolean) {
    const st = this.state;
    const pp = this.findPerson(uid);
    if (pp) {
      pp.person.damaged = false;
      if (!keepReady) pp.person.restoredTurn = st.turn;
      this.fx({ t: 'restore', uid });
      this.log(pp.owner, 'info', `${this.nm(pp.person.id)} je opraven(a)${keepReady ? ' a hned připraven(a)' : ''}.`, [pp.person.id]);
      return;
    }
    const bb = this.findBase(uid);
    if (bb) {
      if (bb.base.charge !== null && bb.base.charge !== bb.owner) {
        bb.base.charge = null;
        this.log(bb.owner, 'info', `Nálož na základně ${this.nm(bb.base.id)} zneškodněna.`);
      }
      if (bb.base.damage > 0) {
        bb.base.damage--;
        this.log(bb.owner, 'info', `Základna ${this.nm(bb.base.id)} je opravena.`, [bb.base.id]);
      }
      this.fx({ t: 'restore', uid });
    }
  }

  restoreAll(p: PlayerIdx) {
    for (const uid of this.restoreTargets(p, {})) this.restoreCard(uid, false);
  }

  *gainDrifter(p: PlayerIdx): Gen {
    if (!this.hasFreeSlot(p)) {
      this.log(p, 'info', 'Na tuláka není místo.');
      return;
    }
    const slot = yield* this.chooseSlot(p, 'Kam postavíš tuláka?', 'tulak');
    if (!slot) return;
    const c = this.drawTop(p);
    const person: PersonInPlay = {
      uid: this.freshUid('t'), id: c.id, faceDown: true, damaged: false,
      playedTurn: this.state.turn, usedTurn: -1, restoredTurn: -1, stunnedTurn: -1, stash: 0,
    };
    this.placePerson(p, person, slot.col, slot.pos);
    this.fx({ t: 'play', uid: person.uid, player: p });
    this.log(p, 'play', `${this.pn(p)} verbuje tuláka (${COL_NAME[slot.col]} sloupec).`, ['tulak']);
  }

  *raid(p: PlayerIdx): Gen {
    const pl = this.state.players[p];
    if (pl.raidHome) {
      const idx = this.eventSlotFor(p, RAID.countdown!);
      if (idx < 0) {
        this.log(p, 'info', 'Nájezd nemá ve frontě místo.');
        return;
      }
      pl.raidHome = false;
      pl.queue[idx] = { uid: this.freshUid('r'), id: 'najezd' };
      this.fx({ t: 'raid', player: p });
      this.log(p, 'event', `${this.pn(p)} vysílá Nájezd (místo ${idx + 1}).`, ['najezd']);
      return;
    }
    const k = pl.queue.findIndex((e) => e?.id === 'najezd');
    if (k === 0) {
      const inst = pl.queue[0]!;
      pl.queue[0] = null;
      this.log(p, 'event', `${this.pn(p)} popohání Nájezd – útočí hned!`, ['najezd']);
      yield* this.resolveEvent(p, inst);
    } else if (k > 0 && pl.queue[k - 1] === null) {
      pl.queue[k - 1] = pl.queue[k];
      pl.queue[k] = null;
      this.fx({ t: 'raid', player: p });
      this.log(p, 'event', `${this.pn(p)} posouvá Nájezd na místo ${k}.`, ['najezd']);
    } else {
      this.log(p, 'info', 'Nájezd nelze posunout – místo před ním je obsazené.');
    }
  }

  *resolveEvent(p: PlayerIdx, inst: CardInst): Gen {
    const def = cardDef(inst.id);
    this.fx({ t: 'event', uid: inst.uid, player: p, id: inst.id });
    if (inst.id !== 'najezd') this.log(p, 'event', `Operace ${def.name} se vyhodnocuje: ${def.effectText}`, [inst.id]);
    try {
      if (def.resolve) yield* def.resolve(this, { p, uid: inst.uid });
    } finally {
      if (inst.id === 'najezd') this.state.players[p].raidHome = true;
      else this.discardOf(p).push(inst);
    }
  }

  *resolveRaid(p: PlayerIdx): Gen {
    const o = this.opp(p);
    const op = this.state.players[o];
    this.fx({ t: 'raid', player: p });
    const opts = op.bases.map((b, col) => ({ b, col })).filter(({ b, col }) => !b.destroyed && !this.bunkerImmune(o, col) && !this.raidGuarded(o, col)).map(({ b }) => b.uid);
    if (opts.length === 0) {
      this.log(p, 'event', 'Nájezd nenašel žádnou základnu, kterou by mohl poškodit.');
      return;
    }
    this.log(p, 'event', `Nájezd hráče ${this.pn(p)} dorazil! ${this.pn(o)} volí, která základna to schytá.`, ['najezd']);
    const uid = yield* this.pick(o, 'NÁJEZD! Vyber svou základnu, která bude poškozena', this.cardOptions(opts, 'danger'));
    if (!uid) return;
    const res = yield* this.damage(uid, p, { kind: 'raid' });
    const commanders = this.activePeople(p).filter((x) => x.id === 'velitelka').length;
    if (res && commanders > 0) {
      this.log(p, 'draw', 'Velitelka Ocel: nájezd byl úspěšný – líže se.');
      this.draw(p, 2 * commanders);
    }
  }

  *advanceEventChoose(c: Ctx): Gen {
    const opts = this.advanceableEvents(c.p);
    const uid = yield* this.pick(c.p, 'Vyber operaci, kterou posuneš vpřed', this.cardOptions(opts), { sourceUid: c.uid });
    if (!uid) return;
    const q = this.state.players[c.p].queue;
    const k = q.findIndex((e) => e?.uid === uid);
    const inst = q[k]!;
    if (k === 0) {
      q[0] = null;
      this.log(c.p, 'event', `${this.nm(inst.id)} se vyhodnocuje okamžitě!`, [inst.id]);
      yield* this.resolveEvent(c.p, inst);
    } else {
      q[k - 1] = inst;
      q[k] = null;
      this.log(c.p, 'event', `${this.nm(inst.id)} se posouvá na místo ${k}.`, [inst.id]);
    }
  }

  *exposeColumnChoose(c: Ctx): Gen {
    const o = this.opp(c.p);
    const cols = this.exposableColumns(c.p);
    const id = yield* this.pick(c.p, 'Vyber soupeřův sloupec, který odkryješ', cols.map((col) => ({ id: String(col), label: `${COL_NAME[col]} sloupec soupeře`, ref: { t: 'column', player: o, col } })), { sourceUid: c.uid });
    if (id === null) return;
    this.state.players[o].exposedTurn[Number(id)] = this.state.turn;
    this.log(c.p, 'info', `Zvěd odkryl ${COL_NAME[Number(id)]} sloupec hráče ${this.pn(o)} – do konce tahu je vše v něm nekryté.`);
  }

  *placeChargeChoose(c: Ctx): Gen {
    const targets = this.chargeTargets(c.p);
    const uid = yield* this.pick(c.p, 'Vyber nekrytou soupeřovu základnu pro nálož', this.cardOptions(targets, 'danger'), { sourceUid: c.uid });
    if (!uid) return;
    const bb = this.findBase(uid)!;
    bb.base.charge = c.p;
    this.log(c.p, 'damage', `Na základně ${this.nm(bb.base.id)} tiká nálož! Vybuchne na začátku dalšího tahu hráče ${this.pn(c.p)}.`, [bb.base.id]);
  }

  *stunChoose(c: Ctx): Gen {
    const targets = this.stunTargets(c.p);
    const uid = yield* this.pick(c.p, 'Vyber nekrytého nepřítele k omráčení', this.cardOptions(targets, 'danger'), { sourceUid: c.uid });
    if (!uid) return;
    const pp = this.findPerson(uid)!;
    pp.person.stunnedTurn = this.state.turn + 1;
    this.fx({ t: 'stun', uid });
    this.log(c.p, 'damage', `${this.nm(pp.person.id)} je omráčen(a) – v příštím tahu nebude připraven(a).`, [pp.person.id]);
  }

  stunAll(o: PlayerIdx) {
    for (const x of this.state.players[o].columns.flat()) {
      if (!x.faceDown) {
        x.stunnedTurn = this.state.turn + 1;
        this.fx({ t: 'stun', uid: x.uid });
      }
    }
    this.log(this.opp(o), 'damage', `Všichni přeživší hráče ${this.pn(o)} jsou omráčeni.`);
  }

  applyDrought(o: PlayerIdx) {
    this.state.players[o].waterPenalty += 1;
    this.log(this.opp(o), 'water', `Sucho: ${this.pn(o)} dostane v příštím tahu o 1 vodu méně.`);
  }

  *smuggle(c: Ctx): Gen {
    const st = this.state;
    const cards: CardInst[] = [this.drawTop(c.p)];
    if (this.canDrawMore(c.p)) cards.push(this.drawTop(c.p));
    this.revealed = true;
    if (cards.length === 1) {
      st.players[c.p].hand.push(cards[0]);
      this.log(c.p, 'draw', `${this.pn(c.p)} si bere kartu z balíčku.`, undefined, { player: c.p, text: `Vzal(a) sis: ${this.nm(cards[0].id)}.` });
      return;
    }
    const id = yield* this.pick(c.p, 'Pašerák: kterou kartu si vezmeš do ruky? (druhá půjde dospod)', cards.map((x) => ({ id: x.uid, label: this.nm(x.id), ref: { t: 'card', id: x.id, uid: x.uid } })), { reveal: cards, sourceUid: c.uid });
    const keep = cards.find((x) => x.uid === id) ?? cards[0];
    const rest = cards.filter((x) => x !== keep);
    st.players[c.p].hand.push(keep);
    for (const r of rest) this.deckOf(c.p).push({ uid: this.freshUid(), id: r.id });
    this.log(c.p, 'draw', `${this.pn(c.p)} si bere jednu kartu a druhou dává dospod balíčku.`, undefined, { player: c.p, text: `Vzal(a) sis ${this.nm(keep.id)}, dospod šla ${rest.map((r) => this.nm(r.id)).join(', ')}.` });
  }

  *reorderTop(p: PlayerIdx, n: number): Gen {
    const st = this.state;
    const deck = this.deckOf(p);
    const cards = deck.slice(0, n);
    if (cards.length === 0) return;
    this.revealed = true;
    if (cards.length === 1) {
      yield* this.ask(p, 'reveal', 'Radiostanice: vrchní karta balíčku', [{ id: 'ok', label: 'Rozumím' }], { reveal: cards });
      return;
    }
    const ans = yield* this.ask(p, 'order', 'Radiostanice: seřaď vrchní karty (první = navrchu)', cards.map((x) => ({ id: x.uid, label: this.nm(x.id), ref: { t: 'card', id: x.id, uid: x.uid } })), { reveal: cards });
    const ordered = ans.map((uid) => cards.find((x) => x.uid === uid)!);
    deck.splice(0, cards.length, ...ordered);
    this.log(p, 'info', `${this.pn(p)} přerovnal(a) vrchní karty balíčku.`);
  }

  *peekHand(p: PlayerIdx): Gen {
    const o = this.opp(p);
    const hand = this.state.players[o].hand;
    this.revealed = true;
    this.log(p, 'info', `${this.pn(p)} si prohlíží ruku hráče ${this.pn(o)}.`);
    yield* this.ask(p, 'reveal', hand.length ? 'Radar: soupeřova ruka' : 'Radar: soupeř nemá v ruce nic', [{ id: 'ok', label: 'Rozumím' }], { reveal: hand.map((h) => ({ ...h })) });
  }

  setStash(uid: string) {
    const pp = this.findPerson(uid);
    if (!pp) return;
    pp.person.stash = 1;
    this.log(pp.owner, 'water', 'Skladnice Marta ukládá vodu do zásoby (+2 na začátku příštího tahu).');
  }

  *bedrichMove(c: Ctx): Gen {
    const cols = this.bedrichMoves(c);
    const id = yield* this.pick(c.p, 'Kam se Bedřich přesune?', cols.map((col) => ({ id: String(col), label: `${COL_NAME[col]} sloupec – vepředu`, ref: { t: 'slot', player: c.p, col, pos: this.state.players[c.p].columns[col].length === 0 ? 'only' : 'front' } })), { sourceUid: c.uid });
    if (id === null) return;
    const loc = this.findPerson(c.uid)!;
    const [person] = this.state.players[c.p].columns[loc.col].splice(loc.idx, 1);
    this.state.players[c.p].columns[Number(id)].push(person);
    this.log(c.p, 'info', `Bedřich se přesouvá do sloupce: ${COL_NAME[Number(id)]}.`);
  }

  *rereadyBaseChoose(c: Ctx): Gen {
    const uid = yield* this.pick(c.p, 'Kterou základnu znovu připravíš?', this.cardOptions(this.usedBases(c.p), 'good'), { sourceUid: c.uid });
    if (!uid) return;
    this.findBase(uid)!.base.usedTurn = -1;
    this.log(c.p, 'info', `${this.nm(this.findBase(uid)!.base.id)} je znovu připravená.`);
  }

  *rereadyPersonChoose(c: Ctx): Gen {
    const uid = yield* this.pick(c.p, 'Kterého přeživšího znovu připravíš?', this.cardOptions(this.usedPeople(c.p, c.uid), 'good'), { sourceUid: c.uid });
    if (!uid) return;
    this.findPerson(uid)!.person.usedTurn = -1;
    this.log(c.p, 'info', `${this.nm(this.findPerson(uid)!.person.id)} je znovu připraven(a).`);
  }

  *injureFrontOfColumn(_c: Ctx, owner: PlayerIdx, col: number): Gen {
    const column = this.state.players[owner].columns[col];
    if (column.length === 0) return;
    const front = column[column.length - 1];
    this.log(this.opp(owner), 'damage', 'Granátník: střepiny zasahují dalšího v řadě!');
    yield* this.damage(front.uid, this.opp(owner), { kind: 'injure' });
  }

  takeTopDiscard(p: PlayerIdx) {
    const c = this.discardOf(p).pop();
    if (!c) return;
    this.state.players[p].hand.push(c);
    this.log(p, 'draw', `${this.pn(p)} bere z odhazovacího balíčku: ${this.nm(c.id)}.`, [c.id]);
  }

  *lassoChoose(c: Ctx): Gen {
    const o = this.opp(c.p);
    const cols = this.swappableEnemyColumns(c.p);
    const id = yield* this.pick(c.p, 'Ve kterém soupeřově sloupci prohodíš přeživší?', cols.map((col) => ({ id: String(col), label: `${COL_NAME[col]} sloupec soupeře`, ref: { t: 'column', player: o, col } })), { sourceUid: c.uid });
    if (id === null) return;
    this.state.players[o].columns[Number(id)].reverse();
    this.log(c.p, 'info', `Lasař přetáhl přeživší v ${COL_NAME[Number(id)]}m sloupci hráče ${this.pn(o)}.`);
  }

  *discardChoose(p: PlayerIdx, n: number, title: string): Gen {
    for (let i = 0; i < n; i++) {
      const opts = this.discardableHand(p);
      if (opts.length === 0) return;
      const uid = yield* this.pick(p, title, opts.map((h) => ({ id: h.uid, label: this.nm(h.id), ref: { t: 'hand', uid: h.uid } })));
      if (!uid) return;
      const c = this.takeFromHand(p, uid);
      this.discardOf(p).push(c);
      this.log(p, 'info', `${this.pn(p)} odhazuje ${this.nm(c.id)}.`, [c.id]);
    }
  }

  *discardUpTo(p: PlayerIdx, n: number, title: string): Gen<number> {
    const opts = this.discardableHand(p);
    if (opts.length === 0) return 0;
    const ans = yield* this.ask(p, 'multi', title, opts.map((h) => ({ id: h.uid, label: this.nm(h.id), ref: { t: 'hand', uid: h.uid } })), { min: 0, max: Math.min(n, opts.length) });
    for (const uid of ans) {
      const c = this.takeFromHand(p, uid);
      this.discardOf(p).push(c);
      this.log(p, 'info', `${this.pn(p)} odhazuje ${this.nm(c.id)}.`, [c.id]);
    }
    return ans.length;
  }

  *mortarChoose(c: Ctx): Gen {
    const uid = yield* this.pick(c.p, 'Minometčík: vyber krytého přeživšího vzadu', this.cardOptions(this.backlineTargets(c.p), 'danger'), { sourceUid: c.uid });
    if (!uid) return;
    yield* this.damage(uid, c.p, { kind: 'injure', srcUid: c.uid, srcIsPerson: true });
  }

  *executeChoose(c: Ctx): Gen {
    const uid = yield* this.pick(c.p, 'Kat: vyber poškozeného nepřítele ke zničení', this.cardOptions(this.damagedEnemies(c.p), 'danger'), { sourceUid: c.uid });
    if (!uid) return;
    this.fx({ t: 'damage', uid, destroyed: true, src: c.uid });
    const owner = this.findPerson(uid)!.owner;
    const col = this.findPerson(uid)!.col;
    yield* this.destroyPerson(uid, c.p);
    yield* this.sentryCheck(owner, col, uid, c.p);
  }

  *sabotageChoose(c: Ctx): Gen {
    const o = this.opp(c.p);
    const opts = this.opponentEvents(c.p);
    const uid = yield* this.pick(c.p, 'Sabotáž: kterou soupeřovu operaci zrušíš?', this.cardOptions(opts, 'danger'), { sourceUid: c.uid });
    if (!uid) return;
    const q = this.state.players[o].queue;
    const k = q.findIndex((e) => e?.uid === uid);
    const inst = q[k]!;
    q[k] = null;
    if (inst.id === 'najezd') this.state.players[o].raidHome = true;
    else this.discardOf(o).push(inst);
    this.log(c.p, 'event', `Sabotáž! Operace ${this.nm(inst.id)} hráče ${this.pn(o)} je zrušena.`, [inst.id]);
  }

  *damageBaseAnyChoose(c: Ctx, title: string, exclude: string[] = []): Gen<string | null> {
    const o = this.opp(c.p);
    const op = this.state.players[o];
    const opts = op.bases.filter((b, col) => !b.destroyed && !this.bunkerImmune(o, col) && !exclude.includes(b.uid)).map((b) => b.uid);
    if (opts.length === 0) return null;
    const uid = yield* this.pick(c.p, title, this.cardOptions(opts, 'danger'), { sourceUid: c.uid });
    if (!uid) return null;
    yield* this.damage(uid, c.p, { kind: 'direct' });
    return uid;
  }

  *evacuateChoose(c: Ctx): Gen {
    yield* this.returnPersonChoose(c, false);
    yield* this.gainDrifter(c.p);
  }

  *returnPersonChoose(c: Ctx, undamagedOnly: boolean): Gen {
    const opts = this.ownFaceUpPeople(c.p, undamagedOnly);
    const uid = yield* this.pick(c.p, 'Kterého přeživšího vrátíš do ruky?', this.cardOptions(opts, 'good'), { sourceUid: c.uid });
    if (!uid) return;
    const loc = this.findPerson(uid)!;
    this.state.players[c.p].columns[loc.col].splice(loc.idx, 1);
    this.state.players[c.p].hand.push({ uid: loc.person.uid, id: loc.person.id });
    this.log(c.p, 'info', `${this.nm(loc.person.id)} se vrací do ruky.`, [loc.person.id]);
  }

  *doubleJunkChoose(c: Ctx): Gen {
    const pl = this.state.players[c.p];
    const uid = yield* this.pick(c.p, 'Šrotiště: kterou kartu rozebereš (efekt 2×)?', pl.hand.map((h) => ({ id: h.uid, label: `${this.nm(h.id)} → ${JUNK_LABEL[cardDef(h.id).junk!]} 2×`, ref: { t: 'hand', uid: h.uid } })), { sourceUid: c.uid });
    if (!uid) return;
    const inst = this.takeFromHand(c.p, uid);
    if (inst.id === 'cisterna') pl.cisternHome = true;
    else this.discardOf(c.p).push(inst);
    const kind = cardDef(inst.id).junk!;
    this.log(c.p, 'play', `${this.pn(c.p)} rozebírá ${this.nm(inst.id)} na Šrotišti → ${JUNK_LABEL[kind]} 2×.`, [inst.id]);
    yield* this.junkEffect(c.p, kind, inst.uid);
    yield* this.junkEffect(c.p, kind, inst.uid);
  }

  *storeWaterChoose(c: Ctx): Gen {
    const pl = this.state.players[c.p];
    const opts: PromptOption[] = [{ id: '1', label: 'Uložit 1 vodu' }];
    if (pl.water >= 2) opts.push({ id: '2', label: 'Uložit 2 vody' });
    const id = yield* this.pick(c.p, 'Kolik vody uložíš do Přehrady?', opts, { sourceUid: c.uid });
    if (id === null) return;
    const n = Number(id);
    pl.water -= n;
    this.findBase(c.uid)!.base.stored += n;
    this.log(c.p, 'water', `${this.pn(c.p)} ukládá ${n} vody do Přehrady.`);
  }

  randomDiscard(o: PlayerIdx) {
    const st = this.state;
    const hand = st.players[o].hand;
    if (hand.length === 0) return;
    const i = randInt(st.rng, hand.length);
    const [c] = hand.splice(i, 1);
    this.revealed = true;
    if (c.id === 'cisterna') st.players[o].cisternHome = true;
    else this.discardOf(o).push(c);
    this.log(this.opp(o), 'info', `Rušička: ${this.pn(o)} přichází o kartu ${this.nm(c.id)}.`, [c.id]);
  }

  *swapColumnsChoose(c: Ctx): Gen {
    const cols = this.state.players[c.p].columns;
    const opt = (col: number): PromptOption => ({ id: String(col), label: `${COL_NAME[col]} sloupec (${cols[col].length} přeživší)`, ref: { t: 'column', player: c.p, col } });
    const a = yield* this.pick(c.p, 'Hangár: první sloupec k prohození', [0, 1, 2].map(opt), { sourceUid: c.uid });
    if (a === null) return;
    const b = yield* this.pick(c.p, 'Hangár: druhý sloupec k prohození', [0, 1, 2].filter((x) => x !== Number(a) && (cols[x].length > 0 || cols[Number(a)].length > 0)).map(opt), { sourceUid: c.uid });
    if (b === null) return;
    const i = Number(a);
    const j = Number(b);
    [cols[i], cols[j]] = [cols[j], cols[i]];
    this.log(c.p, 'info', `${this.pn(c.p)} prohazuje přeživší mezi sloupci ${COL_NAME[i]} a ${COL_NAME[j]}.`);
  }

  /** Prorok Bouře: damage every currently unprotected enemy card once. */
  *stormSweep(c: Ctx): Gen {
    const targets = this.damageTargets(c.p, 'damage');
    this.log(c.p, 'damage', 'Prorok Bouře přivolává bouři!');
    for (const uid of targets) {
      if (!this.findPerson(uid) && !this.findBase(uid)) continue;
      yield* this.damage(uid, c.p, { kind: 'damage', srcUid: c.uid, srcIsPerson: true });
    }
  }

  /** Kyselý déšť: damage every unprotected enemy base. */
  *acidRain(c: Ctx): Gen {
    const o = this.opp(c.p);
    const op = this.state.players[o];
    const targets = op.bases.filter((b, col) => !b.destroyed && (op.columns[col].length === 0 || this.isExposed(o, col))).map((b) => b.uid);
    if (!targets.length) this.log(c.p, 'info', 'Kyselý déšť: žádná nekrytá základna.');
    for (const uid of targets) yield* this.damage(uid, c.p, { kind: 'direct' });
  }

  *shootDrifterChoose(c: Ctx): Gen {
    const uid = yield* this.pick(c.p, 'Střelnice: vyber nekrytého tuláka', this.cardOptions(this.drifterTargets(c.p), 'danger'), { sourceUid: c.uid });
    if (!uid) return;
    yield* this.damage(uid, c.p, { kind: 'injure', srcUid: c.uid });
  }

  // =========================================================================
  // Misc helpers used by tests & UI
  // =========================================================================

  /** Random float from the game RNG (bots must NOT use this; it changes state). */
  random(): number {
    return nextRandom(this.state.rng);
  }
}

const ACTION_TYPES = new Set(['draftPick', 'chooseFirst', 'playPerson', 'playEvent', 'junk', 'drawCard', 'takeCistern', 'ability', 'endTurn', 'undo', 'cancel', 'answer', 'concede']);
const isId = (x: unknown) => typeof x === 'string' && x.length > 0 && x.length <= 40 && /^[\w:.-]+$/.test(x);

/** Strict shape check for actions coming from untrusted clients. */
export function sanitizeAction(a: unknown): string | null {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return 'Neplatná akce.';
  const x = a as Record<string, unknown>;
  if (typeof x.t !== 'string' || !ACTION_TYPES.has(x.t)) return 'Neznámá akce.';
  switch (x.t) {
    case 'draftPick':
      return Array.isArray(x.bases) && x.bases.length === 3 && x.bases.every(isId) ? null : 'Neplatný výběr základen.';
    case 'chooseFirst':
      return x.first === 0 || x.first === 1 ? null : 'Neplatná volba.';
    case 'playPerson':
      if (!isId(x.uid)) return 'Neplatná karta.';
      if (x.col !== undefined && !(Number.isInteger(x.col) && (x.col as number) >= 0 && (x.col as number) <= 2)) return 'Neplatný sloupec.';
      if (x.pos !== undefined && x.pos !== 'back' && x.pos !== 'front' && x.pos !== 'only') return 'Neplatná pozice.';
      return null;
    case 'playEvent':
    case 'junk':
      return isId(x.uid) ? null : 'Neplatná karta.';
    case 'ability':
      return isId(x.uid) && Number.isInteger(x.idx) && (x.idx as number) >= 0 && (x.idx as number) < 8 ? null : 'Neplatná schopnost.';
    case 'answer':
      if (!Number.isInteger(x.promptId)) return 'Neplatná odpověď.';
      return Array.isArray(x.choice) && x.choice.length <= 30 && x.choice.every(isId) ? null : 'Neplatná odpověď.';
    default:
      return null;
  }
}

export function validateAnswer(pr: Prompt, choice: Answer): string | null {
  if (!Array.isArray(choice)) return 'Neplatná odpověď.';
  const ids = new Set(pr.options.map((o) => o.id));
  if (choice.some((c) => typeof c !== 'string' || !ids.has(c))) return 'Neplatná volba.';
  if (new Set(choice).size !== choice.length) return 'Duplicitní volba.';
  switch (pr.kind) {
    case 'pick':
      if (choice.length === 0) return pr.optional ? null : 'Musíš něco vybrat.';
      return choice.length === 1 ? null : 'Vyber jednu možnost.';
    case 'multi': {
      const min = pr.min ?? 0;
      const max = pr.max ?? pr.options.length;
      return choice.length >= min && choice.length <= max ? null : `Vyber ${min}–${max} možností.`;
    }
    case 'order':
      return choice.length === pr.options.length ? null : 'Seřaď všechny karty.';
    case 'reveal':
      return null;
  }
}

export { CISTERN };
