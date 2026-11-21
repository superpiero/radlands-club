// Audit round 1 (rules & engine auditor).
// Every test here DEMONSTRATES a bug found during the audit: it fails on the
// current engine and should pass once the finding is fixed. Each test name
// starts with the finding title used in the audit report.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cardDef } from '../src/engine/cards';
import { buildView } from '../src/engine/view';
import { answer, countCards, giveCard, ok, putPerson, setupGame } from './helpers';

/** Run g.act but turn an unexpected exception into a failed result (so the test can assert). */
function safeAct(fn: () => { ok: boolean }): { ok: boolean; threw?: string } {
  try {
    return fn();
  } catch (e) {
    return { ok: false, threw: (e as Error).message };
  }
}

describe('audit r1 – input validation (server receives raw JSON actions)', () => {
  it('[F1] playPerson accepts col "__proto__" and pollutes Array.prototype', () => {
    const g = setupGame();
    g.state.players[0].water = 3;
    const c = giveCard(g, 0, 'pumpar');
    try {
      const res = safeAct(() => g.act(0, { t: 'playPerson', uid: c.uid, col: '__proto__' as unknown as number, pos: 'only' }));
      const polluted = Object.prototype.hasOwnProperty.call(Array.prototype, '0');
      expect(polluted).toBe(false);
      expect(res.ok).toBe(false);
      expect(g.state.players[0].hand.some((h) => h.uid === c.uid)).toBe(true);
    } finally {
      // never leave the prototype polluted for the rest of this file
      delete (Array.prototype as unknown as Record<string, unknown>)['0'];
      (Array.prototype as unknown as { length: number }).length = 0;
    }
  });

  it('[F2] playPerson with col "constructor" throws mid-action and the card disappears from the game', () => {
    const g = setupGame();
    g.state.players[0].water = 3;
    const c = giveCard(g, 0, 'pumpar');
    const before = countCards(g);
    const res = safeAct(() => g.act(0, { t: 'playPerson', uid: c.uid, col: 'constructor' as unknown as number, pos: 'front' }));
    expect(res.threw).toBeUndefined();
    expect(res.ok).toBe(false);
    expect(countCards(g)).toBe(before);
    expect(g.state.players[0].water).toBe(3);
  });

  it('[F3] ability with a non-integer idx ("length") sets water to NaN and throws', () => {
    const g = setupGame();
    const bara = putPerson(g, 0, 0, 'bara');
    g.state.players[0].water = 3;
    const res = safeAct(() => g.act(0, { t: 'ability', uid: bara.uid, idx: 'length' as unknown as number }));
    expect(res.threw).toBeUndefined();
    expect(res.ok).toBe(false);
    expect(g.state.players[0].water).toBe(3);
    expect(g.isPersonReady(g.findPerson(bara.uid)!.person)).toBe(true);
  });
});

describe('audit r1 – card rules', () => {
  it('[F4] damaged Bedřich still ignores injuries (traits should stop working when damaged, RULES §10)', () => {
    const g = setupGame();
    const b = putPerson(g, 1, 0, 'bedrich', { damaged: true });
    expect(g.damageTargets(0, 'injure')).toContain(b.uid);
    g.damage(b.uid, 0, { kind: 'injure' }).next();
    expect(g.findPerson(b.uid)).toBeNull();
  });

  it('[F5] Vymahač / Vězení cannot stun Bedřich although stun is not an injury (Písečná bouře can)', () => {
    const g = setupGame();
    putPerson(g, 0, 0, 'vymahac');
    const b = putPerson(g, 1, 0, 'bedrich');
    expect(g.stunTargets(0)).toContain(b.uid);
  });

  it('[F9] Radiostanice can be used on an empty deck and silently wastes 1 water', () => {
    const g = setupGame({ bases0: ['radiostanice', 'krater', 'vodarna', 'dilna', 'radar', 'studna'] });
    g.state.deck = [];
    g.state.players[0].water = 2;
    const uid = g.state.players[0].bases[0].uid;
    const err = g.checkAction(0, { t: 'ability', uid, idx: 0 });
    if (err === null) {
      // acceptable fix #2: reshuffle the discard and actually show the cards
      ok(g.act(0, { t: 'ability', uid, idx: 0 }));
      expect(g.state.pending?.reveal?.length ?? 0).toBeGreaterThan(0);
    } else {
      expect(err).toBeTruthy();
    }
  });

  it('[F10] Hangár lets you pick two empty columns (no-op that still costs water)', () => {
    const g = setupGame({ bases0: ['hangar', 'krater', 'vodarna', 'dilna', 'radar', 'studna'] });
    putPerson(g, 0, 0, 'pumpar');
    g.state.players[0].water = 2;
    ok(g.act(0, { t: 'ability', uid: g.state.players[0].bases[0].uid, idx: 0 }));
    answer(g, '1'); // empty column
    const second = g.state.pending!.options.map((o) => o.id);
    expect(second).not.toContain('2'); // column 2 is empty too -> swapping does nothing
  });

  it('[F11] Kluk s prakem shows "must stand unprotected" when it IS unprotected but has no target', () => {
    const g = setupGame();
    const prak = putPerson(g, 0, 0, 'prak'); // alone in column = unprotected; opponent has nobody
    g.state.players[0].water = 3;
    const err = g.checkAction(0, { t: 'ability', uid: prak.uid, idx: 0 });
    expect(err).not.toBeNull();
    expect(err).not.toBe('Musí stát nekrytý (vepředu).');
  });

  it('[F14] first deck exhaustion with an empty discard ends the game claiming the deck ran out "for the second time"', () => {
    const g = setupGame();
    g.state.deck = [];
    g.state.discard = [];
    ok(g.act(0, { t: 'endTurn' })); // P1 draws at replenish
    // Acceptable fixes: skip the draw / keep playing, or end with an accurate reason.
    if (g.state.phase === 'over' && g.state.reshuffles === 0) {
      expect(g.state.winReason ?? '').not.toContain('podruhé');
    }
  });

  it('[F15] card text typo: Kat says "Zniči" (imperative is "Znič")', () => {
    expect(cardDef('kat').abilities[0].text).not.toMatch(/Zniči\b/);
  });
});

describe('audit r1 – hidden information & undo/cancel', () => {
  it('[F6] cancelling a junk still showed the junked hand card to the opponent (log, fx, discard top)', () => {
    const g = setupGame();
    const kat = giveCard(g, 0, 'kat'); // junk = injure -> target prompt
    putPerson(g, 1, 0, 'pumpar');
    ok(g.act(0, { t: 'junk', uid: kat.uid }));
    const opp = buildView(g, 1);
    const leaked = JSON.stringify({ log: opp.log.slice(-3), fx: opp.fx, top: opp.discardTop }).includes('kat')
      || opp.log.slice(-3).some((e) => e.text.includes('Kat'));
    // Either the action must not be cancellable once the card was shown, or the card must not be shown yet.
    expect(leaked && g.canCancel(0)).toBe(false);
  });

  it('[F7] starting to play a survivor puts its name in the opponent\'s "waiting for" banner, then it can be cancelled', () => {
    const g = setupGame();
    g.state.players[0].water = 3;
    const c = giveCard(g, 0, 'granatnik');
    ok(g.act(0, { t: 'playPerson', uid: c.uid })); // the client never sends col/pos -> slot prompt
    const opp = buildView(g, 1);
    const leaked = (opp.waitingFor?.title ?? '').includes('Granátník');
    expect(leaked && g.canCancel(0)).toBe(false);
  });

  it('[F8] after 400 log entries, undo no longer removes the undone action from the log', () => {
    const g = setupGame();
    for (let i = 0; i < 420; i++) g.log(null, 'info', `filler ${i}`);
    g.state.players[0].water = 3;
    const c = giveCard(g, 0, 'felcar');
    ok(g.act(0, { t: 'playPerson', uid: c.uid, col: 2, pos: 'only' }));
    ok(g.act(0, { t: 'undo' }));
    expect(g.state.log.some((e) => e.text.includes('verbuje Felčar'))).toBe(false);
  });
});

describe('audit r1 – docs', () => {
  it('[F12] CARDS.md prints the failure reason as the play condition (Sabotáž/Evakuace read inverted)', () => {
    const md = readFileSync(join(__dirname, '..', 'docs', 'CARDS.md'), 'utf8');
    expect(md).not.toContain('Podmínka: soupeř nemá žádnou operaci ve frontě');
    expect(md).not.toContain('Podmínka: nemáš žádného přeživšího lícem nahoru');
  });
});
