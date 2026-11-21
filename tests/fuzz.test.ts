import { describe, expect, it } from 'vitest';
import { botMove, mulberry, playOut, randomMove } from '../src/engine/bot';
import { Game } from '../src/engine/game';
import { buildView } from '../src/engine/view';
import type { PlayerIdx } from '../src/engine/types';
import { countCards } from './helpers';

function invariants(g: Game, total: number) {
  const st = g.state;
  if (st.pending) return; // cards may be "in flight" while a decision is pending
  for (const pl of st.players) {
    for (const col of pl.columns) expect(col.length).toBeLessThanOrEqual(2);
    expect(pl.water).toBeGreaterThanOrEqual(0);
    expect(pl.queue.length).toBe(3);
    const raids = pl.queue.filter((e) => e?.id === 'najezd').length;
    expect(raids + (pl.raidHome ? 1 : 0)).toBe(1);
    const cis = pl.hand.filter((h) => h.id === 'cisterna').length;
    expect(cis + (pl.cisternHome ? 1 : 0)).toBe(1);
  }
  if ((st.phase === 'play' || st.phase === 'over') && !st.pending) expect(countCards(g)).toBe(total);
}

describe('random fuzzing', () => {
  it('plays 400 random games without errors and with card conservation', () => {
    let finished = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const g = Game.create({ names: ['A', 'B'], seed, baseMode: seed % 2 ? 'draft' : 'random' });
      const r = mulberry(seed * 7);
      let total = -1;
      let n = 0;
      while (g.state.phase !== 'over' && n++ < 4000) {
        let acted = false;
        for (const p of [0, 1] as PlayerIdx[]) {
          const a = randomMove(g, p, r, 0.15);
          if (!a) continue;
          const res = g.act(p, a);
          if (!res.ok) throw new Error(`seed ${seed}: illegal ${JSON.stringify(a)} -> ${res.error}`);
          acted = true;
          break;
        }
        if (!acted) throw new Error(`seed ${seed}: deadlock`);
        if (g.state.phase === 'play' && !g.state.pending && total < 0) total = countCards(g);
        if (total > 0) invariants(g, total);
        // views must always build
        if (n % 25 === 0) { buildView(g, 0); buildView(g, 1); buildView(g, null); }
        // occasionally test cancel / undo / clone
        if (n % 37 === 0 && g.state.pending && g.canCancel(g.state.pending.player)) g.act(g.state.pending.player, { t: 'cancel' });
        if (n % 53 === 0 && g.canUndo(g.state.active)) g.act(g.state.active, { t: 'undo' });
        if (n % 41 === 0) {
          const c = g.clone();
          expect(JSON.stringify(c.state.players)).toBe(JSON.stringify(g.state.players));
        }
      }
      if (g.state.phase === 'over') finished++;
    }
    expect(finished).toBeGreaterThan(300);
  });

  it('greedy bot beats random bot most of the time and games finish', () => {
    let botWins = 0;
    const N = 12;
    for (let seed = 1; seed <= N; seed++) {
      const g = Game.create({ names: ['Bot', 'Rnd'], seed: 1000 + seed, baseMode: 'draft' });
      const r = mulberry(seed);
      const botSide = (seed % 2) as PlayerIdx;
      playOut(g, [
        (gg, p) => (p === botSide ? botMove(gg, p, { rand: r }) : randomMove(gg, p, r, 0.2)),
        (gg, p) => (p === botSide ? botMove(gg, p, { rand: r }) : randomMove(gg, p, r, 0.2)),
      ]);
      expect(g.state.phase).toBe('over');
      if (g.state.winner === botSide) botWins++;
    }
    expect(botWins).toBeGreaterThanOrEqual(N - 2);
  });
});
