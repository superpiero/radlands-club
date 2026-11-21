// Simple AI opponents for "Poslední kapka".
//  * randomMove  – uniformly random legal move (fuzz testing)
//  * botMove     – greedy one-ply search with determinised rollouts and a heuristic evaluation

import { BASES, cardDef } from './cards';
import { Game } from './game';
import { seedState } from './rng';
import type { Action, Answer, PlayerIdx, Prompt } from './types';

export type Rand = () => number;

export function mulberry(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRand<T>(arr: T[], r: Rand): T {
  return arr[Math.floor(r() * arr.length)];
}

function shuffle<T>(arr: T[], r: Rand): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** A random but valid answer to a prompt. */
export function randomAnswer(pr: Prompt, r: Rand): Answer {
  const ids = pr.options.map((o) => o.id);
  switch (pr.kind) {
    case 'pick':
      if (pr.optional && r() < 0.15) return [];
      return [pickRand(ids, r)];
    case 'multi': {
      const min = pr.min ?? 0;
      const max = pr.max ?? ids.length;
      const n = min + Math.floor(r() * (max - min + 1));
      return shuffle([...ids], r).slice(0, n);
    }
    case 'order':
      return shuffle([...ids], r);
    case 'reveal':
      return [ids[0]];
  }
}

export function randomDraft(g: Game, p: PlayerIdx, r: Rand): Action {
  const opts = g.state.players[p].draftOptions;
  return { t: 'draftPick', bases: shuffle([...opts], r).slice(0, 3) };
}

/** Returns the action a random player would take now, or null if it is not this player's decision. */
export function randomMove(g: Game, p: PlayerIdx, r: Rand, endTurnBias = 0.12): Action | null {
  const st = g.state;
  if (st.phase === 'over') return null;
  if (st.phase === 'draft') return st.players[p].draftPicked ? null : randomDraft(g, p, r);
  if (st.pending) {
    if (st.pending.player !== p) return null;
    return { t: 'answer', promptId: st.pending.id, choice: randomAnswer(st.pending, r) };
  }
  const acts = g.legalActions(p);
  if (acts.length === 0) return null;
  if (st.phase === 'chooseFirst') return pickRand(acts, r);
  if (r() < endTurnBias) return { t: 'endTurn' };
  return pickRand(acts, r);
}

// ---------------------------------------------------------------------------
// Heuristic evaluation
// ---------------------------------------------------------------------------

const BASE_ALIVE_VALUE = [0, 40, 70, 92];

/** Value of a queued operation by its effect (not cost). */
function eventValue(g: Game, owner: PlayerIdx, id: string): number {
  const o = (1 - owner) as PlayerIdx;
  switch (id) {
    case 'poslednikapka': return 14;
    case 'podkop': case 'delostrelectvo': case 'kyselydest': return 8;
    case 'karavana': return 6;
    case 'pramen': return 5;
    case 'oaza': return 6 + 3 * g.restoreTargets(owner, {}).length;
    case 'sanitka': return 2 + 3 * g.restoreTargets(owner, {}).length;
    case 'boure': return 1 + 1.5 * g.ownFaceUpPeople(o).length;
    case 'prepad': return 3 + (g.peopleCount(o) >= 4 ? 2 : 0);
    case 'sucho': return 6;
    case 'vysadek': return 5;
    default: return 3.5 + (cardDef(id).cost ?? 0) * 0.8;
  }
}

function sideScore(g: Game, p: PlayerIdx, perspective: PlayerIdx): number {
  const st = g.state;
  const pl = st.players[p];
  let s = 0;
  const alive = pl.bases.filter((b) => !b.destroyed);
  s += BASE_ALIVE_VALUE[alive.length];
  for (const b of alive) {
    const hp = cardDef(b.id).hp ?? 2;
    s -= (b.damage / (hp - 1)) * 11;
    if (cardDef(b.id).abilities.length) s += 2;
    if (b.charge !== null && b.charge !== p) s -= 6;
    s += b.stored * 0.9;
  }
  pl.columns.forEach((column, col) => {
    if (column.length > 0 && !pl.bases[col].destroyed) s += 2.5;
    for (const x of column) {
      if (x.faceDown) { s += 3; continue; }
      const cost = cardDef(x.id).cost ?? 1;
      s += x.damaged ? 2 + cost * 0.6 : 5 + cost * 1.6;
      s += x.stash * 1.8;
      if (x.stunnedTurn > st.turn) s -= 2 + (cardDef(x.id).cost ?? 1);
    }
  });
  for (const h of pl.hand) {
    if (h.id === 'cisterna') { s += 1.2; continue; }
    if (p !== perspective) { s += 2.6; continue; } // never peek at the real opponent hand
    const d = cardDef(h.id);
    s += d.kind === 'survivor' ? 2.0 + 0.5 * (d.cost ?? 1) : 2.2 + 0.6 * (d.cost ?? 1);
  }
  pl.queue.forEach((e, i) => {
    if (!e) return;
    if (e.id === 'najezd') s += 7 - i * 1.5;
    else s += eventValue(g, p, e.id) - i * 0.5;
  });
  if (!pl.raidHome && pl.queue.every((e) => e?.id !== 'najezd')) s += 0; // safety
  if (!pl.cisternHome) s += 0.5;
  // water is only valuable for the player whose turn it is
  if (st.active === p && st.phase === 'play') s += pl.water * (p === perspective ? 0.55 : 0.3);
  s -= pl.waterPenalty * 2.5;
  return s;
}

export function evaluate(g: Game, p: PlayerIdx): number {
  const st = g.state;
  if (st.winner === p) return 1e6;
  if (st.winner === 'draw') return -15; // play on rather than settle for a draw
  if (st.winner !== null) return -1e6;
  const o = (1 - p) as PlayerIdx;
  let v = sideScore(g, p, p) - sideScore(g, o, p) * 1.05;
  // deck-out pressure: when the deck is nearly gone, standing bases decide the game
  if (!st.opts.personal && st.reshuffles > 0 && st.deck.length < 15) {
    const alive = (x: PlayerIdx) => st.players[x].bases.filter((b) => !b.destroyed).length;
    v += 0.8 * (alive(p) - alive(o)) * (15 - st.deck.length);
  }
  return v;
}

// ---------------------------------------------------------------------------
// Greedy bot
// ---------------------------------------------------------------------------

export interface BotOptions {
  level?: 'easy' | 'normal' | 'hard';
  rand?: Rand;
}

function determinize(g: Game, p: PlayerIdx, r: Rand) {
  const st = g.state;
  const o = (1 - p) as PlayerIdx;
  if (st.opts.personal) {
    for (const owner of [0, 1] as PlayerIdx[]) {
      const pl = st.players[owner];
      const hand = owner === o ? pl.hand.filter((h) => h.id !== 'cisterna') : [];
      const drifters = pl.columns.flat().filter((x) => x.faceDown);
      const pool = shuffle([...pl.deck!.map((c) => c.id), ...hand.map((c) => c.id), ...drifters.map((d) => d.id)], r);
      let i = 0;
      for (const c of pl.deck!) c.id = pool[i++];
      for (const c of hand) c.id = pool[i++];
      for (const d of drifters) d.id = pool[i++];
    }
    st.rng = seedState(Math.floor(r() * 2 ** 31));
    return;
  }
  const pool: string[] = [];
  for (const c of st.deck) pool.push(c.id);
  const oppHand = st.players[o].hand.filter((h) => h.id !== 'cisterna');
  for (const c of oppHand) pool.push(c.id);
  const drifters = [...st.players[0].columns.flat(), ...st.players[1].columns.flat()].filter((x) => x.faceDown);
  for (const d of drifters) pool.push(d.id);
  shuffle(pool, r);
  let i = 0;
  for (const c of st.deck) c.id = pool[i++];
  for (const c of oppHand) c.id = pool[i++];
  for (const d of drifters) d.id = pool[i++];
  st.rng = seedState(Math.floor(r() * 2 ** 31));
}

function simClone(g: Game): Game {
  const log = g.state.log;
  g.state.log = [];
  try {
    return g.clone();
  } finally {
    g.state.log = log;
  }
}

/** Run random decisions until the current action is finished (no pending prompt). */
function finishRandomly(g: Game, r: Rand, maxSteps = 40) {
  let n = 0;
  while (g.state.pending && g.state.phase !== 'over' && n++ < maxSteps) {
    const pr = g.state.pending;
    g.act(pr.player, { t: 'answer', promptId: pr.id, choice: randomAnswer(pr, r) });
  }
}

function simulate(g: Game, p: PlayerIdx, apply: (c: Game) => void, r: Rand, rollouts: number): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < rollouts; i++) {
    const c = simClone(g);
    determinize(c, p, r);
    try {
      apply(c);
      finishRandomly(c, r);
    } catch {
      continue;
    }
    sum += evaluate(c, p);
    n++;
  }
  // average over rollouts (max-over-rollouts overrates lucky random follow-ups)
  return n ? sum / n : -Infinity;
}

function answerCandidates(pr: Prompt, r: Rand): Answer[] {
  const ids = pr.options.map((o) => o.id);
  switch (pr.kind) {
    case 'pick': {
      const out = ids.map((id) => [id]);
      if (pr.optional) out.push([]);
      return out;
    }
    case 'multi': {
      const out: Answer[] = [[]];
      const max = pr.max ?? ids.length;
      for (const id of ids) out.push([id]);
      if (max >= 2) for (let i = 0; i < 6; i++) out.push(shuffle([...ids], r).slice(0, max));
      return out.filter((a) => a.length >= (pr.min ?? 0) && a.length <= max);
    }
    case 'order': {
      const out: Answer[] = [];
      for (let i = 0; i < 6; i++) out.push(shuffle([...ids], r));
      return out;
    }
    case 'reveal':
      return [[ids[0]]];
  }
}

const BASE_PREF: Record<string, number> = Object.fromEntries(BASES.map((b) => [b.id, (b.draw ?? 0) * 1.2 + (b.abilities.length ? 1.5 : 0.6)]));
// measured base strength (round-2 sims), adjusted for the follow-up rebalance of the outliers
Object.assign(BASE_PREF, {
  bunkr: 4.4, vysilac: 3.8, pevnost: 4.2, trziste: 4.1, krater: 4.0, studna: 3.7, kantyna: 3.6, dilna: 3.6, nemocnice: 3.6, strelnice: 3.5,
  signal: 3.5, trhaviny: 3.5, vodarna: 3.1, radiostanice: 2.9, hangar: 2.9, benzinka: 2.9, skrys: 2.8, vrakoviste: 2.7, elektrarna: 2.7,
  radar: 2.7, minovepole: 2.7, prehrada: 2.7, stezka: 2.5, hnizdo: 2.4, zbrojnice: 2.2, srotiste: 2.6, ubikace: 2.6, rusicka: 2.4, vezeni: 2.4,
});

// safety net: a bot never takes more than this many actions in one turn (guards against rare action cycles)
const MAX_BOT_ACTIONS_PER_TURN = 60;
const turnCounter = new WeakMap<Game, { turn: number; n: number }>();

export function botMove(g: Game, p: PlayerIdx, opts: BotOptions = {}): Action | null {
  const st = g.state;
  const r = opts.rand ?? Math.random;
  const level = opts.level ?? 'normal';
  const noise = level === 'easy' ? 6 : level === 'normal' ? 0.6 : 0.1;
  const rollouts = level === 'hard' ? 5 : 2;
  if (st.phase === 'over') return null;
  if (st.phase === 'draft') {
    if (st.players[p].draftPicked) return null;
    const noisy = new Map(st.players[p].draftOptions.map((id) => [id, (BASE_PREF[id] ?? 2) + r() * 1.2]));
    const ranked = [...st.players[p].draftOptions].sort((a, b) => noisy.get(b)! - noisy.get(a)!);
    return { t: 'draftPick', bases: ranked.slice(0, 3) };
  }
  if (st.phase === 'chooseFirst') {
    if (st.coinWinner !== p) return null;
    return { t: 'chooseFirst', first: r() < 0.5 ? p : ((1 - p) as PlayerIdx) };
  }
  if (st.pending) {
    const pr = st.pending;
    if (pr.player !== p) return null;
    const cands = answerCandidates(pr, r);
    if (cands.length === 1 || level === 'easy' && r() < 0.5) return { t: 'answer', promptId: pr.id, choice: level === 'easy' ? randomAnswer(pr, r) : cands[0] };
    let best = cands[0];
    let bestV = -Infinity;
    for (const ans of cands) {
      const v = simulate(g, p, (c) => c.act(p, { t: 'answer', promptId: c.state.pending!.id, choice: ans }), r, rollouts) + (r() - 0.5) * noise;
      if (v > bestV) { bestV = v; best = ans; }
    }
    return { t: 'answer', promptId: pr.id, choice: best };
  }
  if (st.active !== p) return null;
  const tc = turnCounter.get(g);
  if (!tc || tc.turn !== st.turn) turnCounter.set(g, { turn: st.turn, n: 1 });
  else if (++tc.n > MAX_BOT_ACTIONS_PER_TURN) return { t: 'endTurn' };
  const acts = g.legalActions(p).filter((a) => a.t !== 'endTurn');
  if (level === 'easy') {
    // a beginner: sometimes ends the turn early, often plays something random instead of the best move
    if (st.players[p].water < 3 && r() < 0.25) return { t: 'endTurn' };
    const cheap = acts.filter((a) => a.t !== 'drawCard' && a.t !== 'takeCistern');
    if (r() < 0.45 && cheap.length) return pickRand(cheap, r);
  }
  // Baseline: water left is wasted at end of turn
  const baseline = evaluate(g, p) - g.state.players[p].water * 0.55;
  let best: Action = { t: 'endTurn' };
  let bestV = baseline + 0.4;
  for (const a of acts) {
    const v = simulate(g, p, (c) => c.act(p, a), r, a.t === 'drawCard' || a.t === 'takeCistern' ? 1 : rollouts) + (r() - 0.5) * noise;
    if (v > bestV) { bestV = v; best = a; }
  }
  return best;
}

/** Play a full game between two policies. Returns the final game. */
export function playOut(g: Game, policies: [(g: Game, p: PlayerIdx) => Action | null, (g: Game, p: PlayerIdx) => Action | null], maxActions = 5000): Game {
  let n = 0;
  while (g.state.phase !== 'over' && n++ < maxActions) {
    let acted = false;
    for (const p of [0, 1] as PlayerIdx[]) {
      const a = policies[p](g, p);
      if (!a) continue;
      const res = g.act(p, a);
      if (!res.ok) throw new Error(`Illegal move by P${p}: ${JSON.stringify(a)} -> ${res.error}`);
      acted = true;
      break;
    }
    if (!acted) throw new Error('Deadlock: nobody can act');
  }
  return g;
}

export { Game };
