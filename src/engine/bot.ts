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
      if (x.stunnedTurn > st.turn) s -= 1.5;
    }
  });
  for (const h of pl.hand) s += h.id === 'cisterna' ? 1.2 : 2.6;
  pl.queue.forEach((e, i) => {
    if (!e) return;
    if (e.id === 'najezd') s += 7 - i * 1.5;
    else s += 3.5 + (cardDef(e.id).cost ?? 0) * 0.8 - i * 0.3;
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
  if (st.winner === 'draw') return 0;
  if (st.winner !== null) return -1e6;
  const o = (1 - p) as PlayerIdx;
  return sideScore(g, p, p) - sideScore(g, o, p) * 1.05;
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
  let best = -Infinity;
  for (let i = 0; i < rollouts; i++) {
    const c = simClone(g);
    determinize(c, p, r);
    try {
      apply(c);
      finishRandomly(c, r);
    } catch {
      continue;
    }
    // If the action ended our turn, value the position from the opponent's start (rough).
    const v = evaluate(c, p);
    if (v > best) best = v;
  }
  return best;
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
Object.assign(BASE_PREF, { zbrojnice: 4.5, vodarna: 3.6, studna: 3.4, hnizdo: 3.3, pevnost: 3.2, krater: 3.6, bunkr: 3.2, trhaviny: 3.0, signal: 3.2, elektrarna: 3.0 });

export function botMove(g: Game, p: PlayerIdx, opts: BotOptions = {}): Action | null {
  const st = g.state;
  const r = opts.rand ?? Math.random;
  const level = opts.level ?? 'normal';
  const noise = level === 'easy' ? 6 : level === 'normal' ? 0.6 : 0.1;
  const rollouts = level === 'hard' ? 4 : 2;
  if (st.phase === 'over') return null;
  if (st.phase === 'draft') {
    if (st.players[p].draftPicked) return null;
    const ranked = [...st.players[p].draftOptions].sort((a, b) => (BASE_PREF[b] ?? 2) + r() * 1.5 - ((BASE_PREF[a] ?? 2) + r() * 1.5));
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
    if (cands.length === 1 || level === 'easy' && r() < 0.3) return { t: 'answer', promptId: pr.id, choice: level === 'easy' ? randomAnswer(pr, r) : cands[0] };
    let best = cands[0];
    let bestV = -Infinity;
    for (const ans of cands) {
      const v = simulate(g, p, (c) => c.act(p, { t: 'answer', promptId: c.state.pending!.id, choice: ans }), r, rollouts) + (r() - 0.5) * noise;
      if (v > bestV) { bestV = v; best = ans; }
    }
    return { t: 'answer', promptId: pr.id, choice: best };
  }
  if (st.active !== p) return null;
  const acts = g.legalActions(p).filter((a) => a.t !== 'endTurn');
  if (level === 'easy' && r() < 0.25 && acts.length) return pickRand(acts, r);
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
