import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mulberry, randomMove } from '../src/engine/bot';
import { Game } from '../src/engine/game';
import type { PlayerIdx } from '../src/engine/types';
import { buildView } from '../src/engine/view';
import { autoDeck, byRarity, deckSize, deckToList, maxCopies, openBooster, starterSet, validateDeck } from '../src/shared/collection';
import { Accounts } from '../src/server/accounts';

describe('collection', () => {
  it('starter set builds a legal auto deck', () => {
    const col = starterSet();
    const deck = autoDeck(col);
    expect(deckSize(deck)).toBe(30);
    expect(validateDeck(deck, col)).toEqual([]);
  });

  it('boosters have 5 cards with a rare slot and respect max copies', () => {
    const r = mulberry(7);
    const col: Record<string, number> = {};
    let legend = 0;
    for (let i = 0; i < 300; i++) {
      const pack = openBooster(col, r);
      expect(pack.length).toBe(5);
      expect(['rare', 'legendary']).toContain(pack[4].rarity);
      legend += pack.filter((c) => c.rarity === 'legendary').length;
    }
    for (const [id, n] of Object.entries(col)) expect(n).toBeLessThanOrEqual(maxCopies(id));
    expect(legend).toBeGreaterThan(30);
    // with 300 packs, everything should be collected
    for (const c of byRarity('common')) expect(col[c.id]).toBe(2);
  });

  it('rejects decks with cards you do not own or too many copies', () => {
    const col = { pumpar: 2, bara: 1 };
    expect(validateDeck({ pumpar: 3 }, col).join(' ')).toMatch(/max/);
    expect(validateDeck({ bara: 2 }, col).join(' ')).toMatch(/máš jen/);
    expect(validateDeck({ najezd: 1 }, col).join(' ')).toMatch(/Neznámá/);
  });
});

describe('personal decks in the engine', () => {
  it('each player draws from their own deck and random games finish', () => {
    const col = starterSet();
    const list = deckToList(autoDeck(col));
    let over = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const g = Game.create({ names: ['A', 'B'], seed, baseMode: 'random', decks: [list, list] });
      const r = mulberry(seed);
      expect(g.state.players[0].deck!.length + g.state.players[0].hand.length).toBe(30);
      let n = 0;
      while (g.state.phase !== 'over' && n++ < 4000) {
        for (const p of [0, 1] as PlayerIdx[]) {
          const a = randomMove(g, p, r, 0.15);
          if (!a) continue;
          const res = g.act(p, a);
          if (!res.ok) throw new Error(`seed ${seed}: ${res.error}`);
          break;
        }
        if (!g.state.pending) {
          for (const p of [0, 1] as PlayerIdx[]) {
            const pl = g.state.players[p];
            const total = pl.deck!.length + pl.discard!.length + pl.hand.filter((h) => h.id !== 'cisterna').length
              + g.state.players[0].columns.flat().concat(g.state.players[1].columns.flat()).filter((x) => g.state.players[p].columns.flat().includes(x)).length
              + pl.queue.filter((e) => e && e.id !== 'najezd').length;
            expect(total).toBe(30);
          }
        }
      }
      if (g.state.phase === 'over') over++;
      const v = buildView(g, 0);
      expect(v.personal).toBe(true);
    }
    expect(over).toBeGreaterThan(100);
  });
});

describe('accounts', () => {
  it('register, login, open welcome boosters, save deck, reward', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pk-acc-'));
    const acc = new Accounts(join(dir, 'a.json'));
    const reg = acc.register('Pepa', 'tajne');
    expect('token' in reg).toBe(true);
    if (!('token' in reg)) return;
    expect(reg.profile.unopened).toBe(3);
    expect('error' in acc.register('pepa', 'xxxx')).toBe(true);
    expect('error' in acc.login('Pepa', 'spatne')).toBe(true);
    const log = acc.login('PEPA', 'tajne');
    expect('token' in log).toBe(true);
    const u = acc.userByToken(reg.token)!;
    for (let i = 0; i < 3; i++) {
      const o = acc.openBooster(u);
      expect('cards' in o && o.cards.length).toBe(5);
    }
    expect('error' in acc.openBooster(u)).toBe(true);
    const deck = autoDeck(u.collection);
    const saved = acc.saveDeck(u, { name: 'Můj', cards: deck });
    expect('deckId' in saved).toBe(true);
    expect('cards' in acc.deckFor(u, (saved as any).deckId)).toBe(true);
    expect(acc.reward('Pepa', 'win', 10)).toBe(100);
    expect(acc.reward('Pepa', 'loss', 2)).toBe(0);
    acc.save(true);
    const acc2 = new Accounts(join(dir, 'a.json'));
    expect(acc2.userByToken(reg.token)?.name).toBe('Pepa');
    expect(acc2.get('pepa')!.kapky).toBe(100);
  });
});

describe('all collectible cards in personal decks (fuzz)', () => {
  it('random games with every collectible card never break invariants', () => {
    const all = byRarity('common').concat(byRarity('uncommon'), byRarity('rare'), byRarity('legendary'));
    const list: string[] = [];
    for (const c of all) for (let i = 0; i < maxCopies(c.id); i++) list.push(c.id);
    let over = 0;
    for (let seed = 500; seed < 700; seed++) {
      const g = Game.create({ names: ['A', 'B'], seed, baseMode: seed % 2 ? 'draft' : 'random', decks: [list, list] });
      const r = mulberry(seed);
      let n = 0;
      while (g.state.phase !== 'over' && n++ < 5000) {
        let acted = false;
        for (const p of [0, 1] as PlayerIdx[]) {
          const a = randomMove(g, p, r, 0.12);
          if (!a) continue;
          const res = g.act(p, a);
          if (!res.ok) throw new Error(`seed ${seed}: ${JSON.stringify(a)} ${res.error}`);
          acted = true;
          break;
        }
        expect(acted).toBe(true);
        for (const pl of g.state.players) {
          for (const col of pl.columns) expect(col.length).toBeLessThanOrEqual(2);
          expect(Number.isFinite(pl.water)).toBe(true);
        }
      }
      if (g.state.phase === 'over') over++;
    }
    expect(over).toBeGreaterThan(180);
  });
});
