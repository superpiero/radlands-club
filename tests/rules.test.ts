import { describe, expect, it } from 'vitest';
import { buildView } from '../src/engine/view';
import { answer, giveCard, ok, putPerson, setupGame } from './helpers';

describe('setup & turn flow', () => {
  it('draws starting hand equal to base draw values and gives first player 1 water', () => {
    const g = setupGame();
    const st = g.state;
    // P0 bases: krater(3) vodarna(1) zbrojnice(0) = 4, plus 1 draw on turn 1
    expect(st.players[0].hand.length).toBe(5);
    // P1 bases: krater(3) elektrarna(0) hnizdo(2) = 5
    expect(st.players[1].hand.length).toBe(5);
    expect(st.turn).toBe(1);
    expect(st.active).toBe(0);
    expect(st.players[0].water).toBe(1);
    expect(st.step).toBe('actions');
  });

  it('second player gets 3 water and draws', () => {
    const g = setupGame();
    ok(g.act(0, { t: 'endTurn' }));
    expect(g.state.active).toBe(1);
    expect(g.state.players[1].water).toBe(3);
    expect(g.state.players[1].hand.length).toBe(6);
    expect(g.state.players[0].water).toBe(0);
  });

  it('rejects actions from the inactive player', () => {
    const g = setupGame();
    const r = g.act(1, { t: 'endTurn' });
    expect(r.ok).toBe(false);
  });
});

describe('people & protection', () => {
  it('plays a person into a chosen slot and it is not ready this turn', () => {
    const g = setupGame();
    g.state.players[0].water = 3;
    const c = giveCard(g, 0, 'bara');
    ok(g.act(0, { t: 'playPerson', uid: c.uid }));
    answer(g, '1:only');
    const person = g.state.players[0].columns[1][0];
    expect(person.id).toBe('bara');
    expect(g.isPersonReady(person)).toBe(false);
    expect(g.state.players[0].water).toBe(1);
  });

  it('only unprotected cards can be damaged', () => {
    const g = setupGame();
    const back = putPerson(g, 1, 0, 'felcar');
    const front = putPerson(g, 1, 0, 'pumpar');
    const targets = g.damageTargets(0, 'damage');
    expect(targets).toContain(front.uid);
    expect(targets).not.toContain(back.uid);
    expect(targets).not.toContain(g.state.players[1].bases[0].uid);
    expect(targets).toContain(g.state.players[1].bases[1].uid);
  });

  it('damage twice destroys a person; the person behind moves forward', () => {
    const g = setupGame();
    g.state.players[0].water = 3;
    const back = putPerson(g, 1, 0, 'felcar');
    const front = putPerson(g, 1, 0, 'pumpar');
    const it = g.damage(front.uid, 0, { kind: 'damage' });
    it.next();
    expect(front.damaged).toBe(true);
    const it2 = g.damage(front.uid, 0, { kind: 'damage' });
    it2.next();
    expect(g.state.players[1].columns[0].map((x) => x.uid)).toEqual([back.uid]);
    expect(g.state.discard.some((c) => c.id === 'pumpar')).toBe(true);
    expect(g.isUnprotected(back.uid)).toBe(true);
  });

  it('a damaged drifter is destroyed and returns face down to the top of the deck', () => {
    const g = setupGame();
    const d = putPerson(g, 1, 2, 'kat', { faceDown: true });
    const top = g.state.deck.length;
    g.damage(d.uid, 0, { kind: 'injure' }).next();
    expect(g.state.players[1].columns[2].length).toBe(0);
    expect(g.state.deck.length).toBe(top + 1);
    expect(g.state.deck[0].id).toBe('kat');
  });

  it('max 6 people', () => {
    const g = setupGame();
    for (let c = 0; c < 3; c++) { putPerson(g, 0, c, 'pumpar'); putPerson(g, 0, c, 'pumpar'); }
    g.state.players[0].water = 3;
    const card = giveCard(g, 0, 'prak');
    expect(g.act(0, { t: 'playPerson', uid: card.uid }).ok).toBe(false);
  });
});

describe('abilities', () => {
  it('using an ability pays water and exhausts the card', () => {
    const g = setupGame();
    const bara = putPerson(g, 0, 0, 'bara');
    g.state.players[0].water = 3;
    ok(g.act(0, { t: 'ability', uid: bara.uid, idx: 0 }));
    expect(g.state.players[0].water).toBe(1);
    const target = g.state.players[1].bases[0].uid;
    answer(g, target);
    expect(g.state.players[1].bases[0].damage).toBe(1);
    expect(g.isPersonReady(bara)).toBe(false);
    expect(g.act(0, { t: 'ability', uid: bara.uid, idx: 0 }).ok).toBe(false);
  });

  it('cancel before any hidden info restores the state', () => {
    const g = setupGame();
    const bara = putPerson(g, 0, 0, 'bara');
    g.state.players[0].water = 3;
    ok(g.act(0, { t: 'ability', uid: bara.uid, idx: 0 }));
    expect(g.state.pending).not.toBeNull();
    ok(g.act(0, { t: 'cancel' }));
    expect(g.state.pending).toBeNull();
    expect(g.state.players[0].water).toBe(3);
    const b2 = g.findPerson(bara.uid)!.person;
    expect(g.isPersonReady(b2)).toBe(true);
  });

  it('undo after a completed action without hidden info', () => {
    const g = setupGame();
    g.state.players[0].water = 3;
    const c = giveCard(g, 0, 'felcar');
    ok(g.act(0, { t: 'playPerson', uid: c.uid, col: 2, pos: 'only' }));
    expect(g.state.players[0].columns[2].length).toBe(1);
    ok(g.act(0, { t: 'undo' }));
    expect(g.state.players[0].columns[2].length).toBe(0);
    expect(g.state.players[0].hand.some((h) => h.uid === c.uid)).toBe(true);
  });

  it('undo is blocked after drawing a card', () => {
    const g = setupGame();
    g.state.players[0].water = 3;
    ok(g.act(0, { t: 'drawCard' }));
    expect(g.canUndo(0)).toBe(false);
  });

  it('Bedřich ignores injure', () => {
    const g = setupGame();
    const b = putPerson(g, 1, 0, 'bedrich');
    expect(g.damageTargets(0, 'injure')).not.toContain(b.uid);
    expect(g.damageTargets(0, 'damage')).toContain(b.uid);
  });

  it('Zvěd exposes a column so protected cards become targets', () => {
    const g = setupGame();
    const zved = putPerson(g, 0, 0, 'zved');
    const back = putPerson(g, 1, 1, 'felcar');
    putPerson(g, 1, 1, 'pumpar');
    g.state.players[0].water = 3;
    ok(g.act(0, { t: 'ability', uid: zved.uid, idx: 0 }));
    answer(g, '1');
    expect(g.damageTargets(0, 'damage')).toContain(back.uid);
    expect(g.damageTargets(0, 'damage')).toContain(g.state.players[1].bases[1].uid);
  });

  it('Hana places a charge that detonates on her next turn even if protected', () => {
    const g = setupGame();
    const hana = putPerson(g, 0, 0, 'hana');
    g.state.players[0].water = 3;
    const base = g.state.players[1].bases[2];
    ok(g.act(0, { t: 'ability', uid: hana.uid, idx: 0 }));
    answer(g, base.uid);
    expect(base.charge).toBe(0);
    ok(g.act(0, { t: 'endTurn' }));
    putPerson(g, 1, 2, 'pumpar');
    ok(g.act(1, { t: 'endTurn' }));
    expect(g.state.players[1].bases[2].damage).toBe(1);
    expect(g.state.players[1].bases[2].charge).toBe(null);
  });

  it('Pevnost needs three damage', () => {
    const g = setupGame({ bases1: ['pevnost', 'krater', 'vodarna', 'dilna', 'radar', 'studna'] });
    const b = g.state.players[1].bases[0];
    expect(b.id).toBe('pevnost');
    g.damage(b.uid, 0, { kind: 'direct' }).next();
    g.damage(b.uid, 0, { kind: 'direct' }).next();
    expect(b.destroyed).toBe(false);
    g.damage(b.uid, 0, { kind: 'direct' }).next();
    expect(b.destroyed).toBe(true);
  });

  it('Bunkr cannot be damaged while its column is full', () => {
    const g = setupGame({ bases1: ['bunkr', 'krater', 'vodarna', 'dilna', 'radar', 'studna'] });
    putPerson(g, 1, 0, 'pumpar');
    putPerson(g, 1, 0, 'pumpar');
    expect(g.bunkerImmune(1, 0)).toBe(true);
    g.damage(g.state.players[1].bases[0].uid, 0, { kind: 'raid' }).next();
    expect(g.state.players[1].bases[0].damage).toBe(0);
  });
});

describe('events & raid', () => {
  it('raid goes to slot 2, advances, resolves and opponent chooses the base', () => {
    const g = setupGame();
    const c = giveCard(g, 0, 'hana'); // junk = raid
    ok(g.act(0, { t: 'junk', uid: c.uid }));
    expect(g.state.players[0].queue[1]?.id).toBe('najezd');
    expect(g.state.players[0].raidHome).toBe(false);
    ok(g.act(0, { t: 'endTurn' }));
    ok(g.act(1, { t: 'endTurn' }));
    // P0's turn 3: raid moved to slot 1
    expect(g.state.players[0].queue[0]?.id).toBe('najezd');
    ok(g.act(0, { t: 'endTurn' }));
    ok(g.act(1, { t: 'endTurn' }));
    // raid resolved at start of P0 turn 5: P1 must choose a base
    expect(g.state.pending?.player).toBe(1);
    const choice = g.state.pending!.options[1].id;
    answer(g, choice);
    expect(g.state.players[1].bases.find((b) => b.uid === choice)!.damage).toBe(1);
    expect(g.state.players[0].raidHome).toBe(true);
  });

  it('playing an event places it by countdown, pushes back if occupied', () => {
    const g = setupGame();
    g.state.players[0].water = 5;
    const a = giveCard(g, 0, 'karavana');
    const b = giveCard(g, 0, 'karavana');
    ok(g.act(0, { t: 'playEvent', uid: a.uid }));
    ok(g.act(0, { t: 'playEvent', uid: b.uid }));
    expect(g.state.players[0].queue[1]?.uid).toBe(a.uid);
    expect(g.state.players[0].queue[2]?.uid).toBe(b.uid);
  });

  it('instant events resolve immediately', () => {
    const g = setupGame();
    g.state.players[0].water = 3;
    const v = giveCard(g, 0, 'vymena');
    const h0 = g.state.players[0].hand.length;
    ok(g.act(0, { t: 'playEvent', uid: v.uid }));
    expect(g.state.pending?.kind).toBe('multi');
    answer(g, []);
    expect(g.state.players[0].hand.length).toBe(h0 - 1 + 1);
  });

  it('Sucho reduces opponent water next turn', () => {
    const g = setupGame();
    g.state.players[0].water = 3;
    const s = giveCard(g, 0, 'sucho');
    ok(g.act(0, { t: 'playEvent', uid: s.uid }));
    ok(g.act(0, { t: 'endTurn' }));
    ok(g.act(1, { t: 'endTurn' }));
    // resolves at start of P0 turn 3
    ok(g.act(0, { t: 'endTurn' }));
    expect(g.state.players[1].water).toBe(2);
  });
});

describe('cistern & draw', () => {
  it('take and junk the cistern', () => {
    const g = setupGame();
    g.state.players[0].water = 2;
    ok(g.act(0, { t: 'takeCistern' }));
    expect(g.state.players[0].cisternHome).toBe(false);
    const cis = g.state.players[0].hand.find((h) => h.id === 'cisterna')!;
    ok(g.act(0, { t: 'junk', uid: cis.uid }));
    expect(g.state.players[0].cisternHome).toBe(true);
    expect(g.state.players[0].water).toBe(2);
    // only once per turn – otherwise "take & junk" loops forever
    const again = g.act(0, { t: 'takeCistern' });
    expect(again.ok).toBe(false);
  });

  it('draw card costs 2 water', () => {
    const g = setupGame();
    g.state.players[0].water = 2;
    const n = g.state.players[0].hand.length;
    ok(g.act(0, { t: 'drawCard' }));
    expect(g.state.players[0].hand.length).toBe(n + 1);
    expect(g.state.players[0].water).toBe(0);
  });
});

describe('win & views', () => {
  it('destroying all three bases wins immediately', () => {
    const g = setupGame();
    const bara = putPerson(g, 0, 0, 'bara');
    for (const b of g.state.players[1].bases.slice(0, 2)) { b.damage = 1; b.destroyed = true; }
    g.state.players[1].bases[2].damage = 1;
    g.state.players[0].water = 3;
    ok(g.act(0, { t: 'ability', uid: bara.uid, idx: 0 }));
    answer(g, g.state.players[1].bases[2].uid);
    expect(g.state.phase).toBe('over');
    expect(g.state.winner).toBe(0);
  });

  it('views hide opponent hand and drifter identity', () => {
    const g = setupGame();
    putPerson(g, 1, 0, 'kat', { faceDown: true });
    const v = buildView(g, 0);
    expect(v.players[1].hand).toBeNull();
    expect(v.players[0].hand).not.toBeNull();
    expect(v.players[1].columns[0][0].id).toBe('tulak');
    expect(JSON.stringify(v)).not.toContain('"kat"');
  });
});
