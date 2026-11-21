// Audit round 2 (rules & engine auditor).
// Every test here DEMONSTRATES a bug found during the audit: it fails on the
// current code and should pass once the finding is fixed. Test names start with
// the finding id used in the audit report.

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mulberry } from '../src/engine/bot';
import { Game } from '../src/engine/game';
import type { PlayerIdx } from '../src/engine/types';
import { buildView } from '../src/engine/view';
import { BOOSTER_PRICE, collectibleCards, maxCopies, openBooster } from '../src/shared/collection';
import { Accounts } from '../src/server/accounts';
import { Lobby, Room, type Client } from '../src/server/rooms';
import { answer, giveCard, ok, putPerson, setupGame } from './helpers';

function fakeClient(token: string, name: string, account: string | null = null): Client {
  return { ws: { readyState: 1, send: () => {} } as unknown as Client['ws'], token, name, account, room: null, lastMsgs: [] };
}

function personalGame(): Game {
  const list = Array(30).fill('pumpar');
  const g = Game.create({ names: ['A', 'B'], seed: 3, baseMode: 'random', decks: [list, list] });
  ok(g.act(g.state.coinWinner, { t: 'chooseFirst', first: 0 }));
  return g;
}

/** Play `n` empty turns (only endTurn) and return. */
function emptyTurns(room: Room, seatClient: (i: PlayerIdx) => Client, n: number) {
  const g = room.game!;
  for (let i = 0; i < n; i++) room.act(seatClient(g.state.active), { t: 'endTurn' });
}

describe('audit r2 – hidden information (cancel after a card was shown)', () => {
  it('[R2-03] Šrotiště: the junked hand card is shown (log + discard top) and the action can still be cancelled', () => {
    const g = setupGame({ bases0: ['srotiste', 'krater', 'vodarna', 'dilna', 'radar', 'studna'] });
    g.state.players[0].water = 3;
    const kat = giveCard(g, 0, 'kat'); // junk = injure -> target prompt follows
    putPerson(g, 1, 0, 'pumpar');
    ok(g.act(0, { t: 'ability', uid: g.state.players[0].bases[0].uid, idx: 0 }));
    answer(g, kat.uid);
    const opp = buildView(g, 1);
    const shown = opp.discardTop?.id === 'kat' || opp.log.slice(-3).some((e) => e.text.includes('Kat'));
    expect(shown && g.canCancel(0)).toBe(false);
  });

  it('[R2-03] Vrakoviště: the discarded hand card is shown and the drifter slot prompt can still be cancelled', () => {
    const g = setupGame({ bases0: ['vrakoviste', 'krater', 'vodarna', 'dilna', 'radar', 'studna'] });
    g.state.players[0].water = 3;
    const kat = giveCard(g, 0, 'kat');
    giveCard(g, 0, 'pumpar');
    ok(g.act(0, { t: 'ability', uid: g.state.players[0].bases[0].uid, idx: 0 }));
    answer(g, kat.uid); // discard Kat -> "Kam postavíš tuláka?"
    const opp = buildView(g, 1);
    const shown = opp.discardTop?.id === 'kat' || opp.log.slice(-3).some((e) => e.text.includes('Kat'));
    expect(shown && g.canCancel(0)).toBe(false);
  });

  it('[R2-09] playPerson: while the slot prompt is open (cancellable) the opponent already sees the water cost and the hand shrink', () => {
    const g = setupGame();
    g.state.players[0].water = 3;
    const c = giveCard(g, 0, 'granatnik'); // cost 3
    const before = buildView(g, 1).players[0];
    ok(g.act(0, { t: 'playPerson', uid: c.uid })); // the client never sends col/pos
    const during = buildView(g, 1).players[0];
    const leaked = during.water !== before.water || during.handCount !== before.handCount;
    expect(leaked && g.canCancel(0)).toBe(false);
  });
});

describe('audit r2 – rewards & timer (server)', () => {
  it('[R2-01] one account in both seats farms win+loss rewards with 6 empty turns + concede', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pk-r2-'));
    const acc = new Accounts(join(dir, 'a.json'));
    acc.register('Farmar', 'heslo1');
    const lobby = new Lobby(acc);
    const room = lobby.create({ baseMode: 'random' });
    const a = fakeClient('tok-a', 'Farmar', 'Farmar');
    const b = fakeClient('tok-b', 'Farmar', 'Farmar'); // same account, second socket
    expect(room.join(a)).toBeNull();
    expect(room.join(b)).toBeNull();
    const seat = (i: PlayerIdx) => (i === 0 ? a : b);
    room.act(seat(room.game!.state.coinWinner), { t: 'chooseFirst', first: 0 });
    emptyTurns(room, seat, 6);
    room.act(a, { t: 'concede' });
    expect(room.game!.state.phase).toBe('over');
    // currently: +100 (win) +50 (loss) = 150 kapky in a few messages; rematch makes it a loop
    expect(acc.get('Farmar')!.kapky).toBe(0);
  });

  it('[R2-01] a game where nobody did anything but end turns still pays full rewards', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pk-r2-'));
    const acc = new Accounts(join(dir, 'a.json'));
    acc.register('Solo', 'heslo1');
    const lobby = new Lobby(acc);
    const room = lobby.create({ baseMode: 'random' });
    const a = fakeClient('tok-s', 'Solo', 'Solo');
    const b = fakeClient('tok-guest', 'Host'); // own second tab as guest
    room.join(a);
    room.join(b);
    const seat = (i: PlayerIdx) => (i === 0 ? a : b);
    room.act(seat(room.game!.state.coinWinner), { t: 'chooseFirst', first: 0 });
    emptyTurns(room, seat, 6);
    room.act(b, { t: 'concede' });
    expect(acc.get('Solo')!.kapky).toBe(0);
  });

  it('[R2-02] turn timer: opening a prompt and cancelling it resets the turn clock (infinite stalling)', () => {
    const lobby = new Lobby();
    const room = lobby.create({ baseMode: 'random', turnSeconds: 60 });
    const a = fakeClient('tt-a', 'A');
    const b = fakeClient('tt-b', 'B');
    room.join(a);
    room.join(b);
    const g = room.game!;
    room.act(g.state.coinWinner === 0 ? a : b, { t: 'chooseFirst', first: 0 });
    let now = Date.now();
    room.tick(now);
    g.state.players[0].hand.push({ uid: 'stall', id: 'pumpar' });
    g.state.players[0].water = 3;
    now += 55_000;
    room.tick(now);
    room.act(a, { t: 'playPerson', uid: 'stall' }); // slot prompt opens
    now += 1_000;
    room.tick(now);
    room.act(a, { t: 'cancel' });
    now += 1_000;
    room.tick(now);
    // 57 s of the 60 s turn are gone – the clock must not be back at 60 s
    expect(room.turnLeft(now)!).toBeLessThanOrEqual(5_000);
  });
});

describe('audit r2 – personal decks (collection mode)', () => {
  it('[R2-05] killing the opponent\'s Pes Rex while their deck is exhausted makes THEM lose (drifter is drawn from an empty deck)', () => {
    const g = personalGame();
    const p1 = g.state.players[1];
    p1.deck = [];
    p1.discard = [];
    p1.reshuffles = 1;
    const rex = putPerson(g, 1, 0, 'rex', { damaged: true });
    const bara = putPerson(g, 0, 0, 'bara');
    g.state.players[0].water = 3;
    ok(g.act(0, { t: 'ability', uid: bara.uid, idx: 0 }));
    if (g.state.pending) answer(g, rex.uid);
    if (g.state.pending) answer(g, g.state.pending.options[0].id); // P1 places the "drifter"
    expect(g.state.phase).not.toBe('over');
  });

  it('[R2-05] drawing a card for water is offered (and instantly loses) when the personal deck is exhausted', () => {
    const g = personalGame();
    const p0 = g.state.players[0];
    p0.deck = [];
    p0.discard = [];
    p0.reshuffles = 1;
    p0.water = 3;
    expect(g.legalInfo(0).canDraw).toBe(false);
  });
});

describe('audit r2 – engine safety net', () => {
  it('[R2-06] a rolled-back action stays in Room.history -> the room cannot be restored after a restart', () => {
    const lobby = new Lobby();
    const room = lobby.create({ baseMode: 'random' });
    const a = fakeClient('rb-a', 'A');
    const b = fakeClient('rb-b', 'B');
    room.join(a);
    room.join(b);
    const g0 = room.game!;
    room.act(g0.state.coinWinner === 0 ? a : b, { t: 'chooseFirst', first: 0 });
    // Simulate a latent engine bug that throws after the player answered a prompt.
    const proto = Game.prototype as unknown as { junkEffect: (...x: unknown[]) => Generator };
    const orig = proto.junkEffect;
    proto.junkEffect = function* (this: Game, p: PlayerIdx) {
      yield* this.chooseSlot(p, 'test');
      throw new Error('latent engine bug');
    } as never;
    const err = console.error;
    console.error = () => {};
    try {
      const card = room.game!.state.players[0].hand[0];
      room.act(a, { t: 'junk', uid: card.uid });
      const pr = room.game!.state.pending!;
      room.act(a, { t: 'answer', promptId: pr.id, choice: [pr.options[0].id] }); // throws inside -> rollback
      expect(room.game!.state.players[0].hand.some((h) => h.uid === card.uid)).toBe(true); // rolled back live
      room.act(a, { t: 'endTurn' }); // the game goes on normally
      expect(() => Room.fromSnapshot(room.snapshot())).not.toThrow();
    } finally {
      proto.junkEffect = orig;
      console.error = err;
    }
  });
});

describe('audit r2 – collection economy & accounts', () => {
  it('[R2-07] booster dust: a fully collected account mints kapky (avg dust per pack > booster price)', () => {
    const r = mulberry(11);
    let dust = 0;
    for (let i = 0; i < 200; i++) {
      const col: Record<string, number> = {};
      for (const c of collectibleCards()) col[c.id] = maxCopies(c.id);
      dust += openBooster(col, r).reduce((s, c) => s + c.dust, 0);
    }
    expect(dust / 200).toBeLessThan(BOOSTER_PRICE);
  });

  it('[R2-10] login with a name like "constructor" throws instead of returning an error', () => {
    const acc = new Accounts(join(mkdtempSync(join(tmpdir(), 'pk-r2-')), 'a.json'));
    expect(() => acc.login('constructor', 'heslo')).not.toThrow();
    expect(() => acc.login('__proto__', 'heslo')).not.toThrow();
  });

  it('[R2-10] login does not normalise whitespace like register does', () => {
    const acc = new Accounts(join(mkdtempSync(join(tmpdir(), 'pk-r2-')), 'a.json'));
    const reg = acc.register('Pepa  Novák', 'heslo1');
    expect('token' in reg).toBe(true);
    expect('token' in acc.login('Pepa  Novák', 'heslo1')).toBe(true);
  });
});

describe('audit r2 – rules text / docs consistency', () => {
  it('[R2-08] classic reshuffle message and RULES.md still say the second deck-out is a draw (engine uses a base tiebreak)', () => {
    const g = setupGame();
    g.state.discard = g.state.deck.splice(0);
    ok(g.act(0, { t: 'endTurn' })); // P1 draws -> reshuffle
    const msg = g.state.log.find((e) => e.text.includes('Balíček došel'))!.text;
    expect(msg).not.toContain('remízou');
    const rules = readFileSync(join(__dirname, '..', 'docs', 'RULES.md'), 'utf8');
    expect(rules).not.toMatch(/Dojde podruhé → remíza/);
  });

  it('[R2-12] Matka Prachu: damaged drifters can never be repaired, not even by Sanitka/Oáza ("všechny své karty")', () => {
    const g = setupGame();
    putPerson(g, 0, 0, 'matka');
    const t = putPerson(g, 0, 1, 'pumpar', { faceDown: true, damaged: true });
    g.restoreAll(0);
    expect(g.findPerson(t.uid)!.person.damaged).toBe(false);
  });

  it('[R2-13] Mechanička Jiskra re-readies a base whose ability can no longer be used (water wasted; Bubeník filters this)', () => {
    const g = setupGame({ bases0: ['rusicka', 'krater', 'vodarna', 'dilna', 'radar', 'studna'] });
    const j = putPerson(g, 0, 0, 'jiskra');
    g.state.players[0].water = 5;
    g.state.players[1].hand = [{ uid: 'only', id: 'pumpar' }];
    ok(g.act(0, { t: 'ability', uid: g.state.players[0].bases[0].uid, idx: 0 })); // Rušička: opponent hand now empty
    expect(g.checkAction(0, { t: 'ability', uid: j.uid, idx: 0 })).not.toBeNull();
  });
});
