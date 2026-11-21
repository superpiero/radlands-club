import { Game } from '../src/engine/game';
import type { CardInst, PersonInPlay, PlayerIdx } from '../src/engine/types';

/** Create a game already in the play phase with fixed bases and empty hands. */
export function setupGame(opts: { bases0?: string[]; bases1?: string[]; seed?: number; first?: PlayerIdx } = {}): Game {
  const g = Game.create({ names: ['Alfa', 'Beta'], seed: opts.seed ?? 42, baseMode: 'draft' });
  const st = g.state;
  // force draft options so picks are valid
  st.players[0].draftOptions = opts.bases0 ?? ['krater', 'vodarna', 'zbrojnice', 'dilna', 'radar', 'studna'];
  st.players[1].draftOptions = opts.bases1 ?? ['krater', 'elektrarna', 'hnizdo', 'trziste', 'ubikace', 'vezeni'];
  ok(g.act(0, { t: 'draftPick', bases: st.players[0].draftOptions.slice(0, 3) }));
  ok(g.act(1, { t: 'draftPick', bases: st.players[1].draftOptions.slice(0, 3) }));
  const first = opts.first ?? 0;
  ok(g.act(g.state.coinWinner, { t: 'chooseFirst', first }));
  return g;
}

export function ok(res: { ok: boolean; error?: string }) {
  if (!res.ok) throw new Error(`Action failed: ${(res as any).error}`);
}

export function giveCard(g: Game, p: PlayerIdx, id: string): CardInst {
  const c = { uid: `x${++g.state.seq}`, id };
  g.state.players[p].hand.push(c);
  return c;
}

export function putPerson(g: Game, p: PlayerIdx, col: number, id: string, extra: Partial<PersonInPlay> = {}): PersonInPlay {
  const person: PersonInPlay = {
    uid: `x${++g.state.seq}`, id, faceDown: false, damaged: false,
    playedTurn: -5, usedTurn: -5, restoredTurn: -5, stunnedTurn: -5, stash: 0, ...extra,
  };
  g.state.players[p].columns[col].push(person);
  return person;
}

export function answer(g: Game, choice: string[] | string) {
  const pr = g.state.pending!;
  if (!pr) throw new Error('No pending prompt');
  ok(g.act(pr.player, { t: 'answer', promptId: pr.id, choice: Array.isArray(choice) ? choice : [choice] }));
}

/** Count all physical cards to verify conservation. */
export function countCards(g: Game): number {
  const st = g.state;
  let n = st.deck.length + st.discard.length;
  for (const pl of st.players) {
    n += pl.hand.filter((h) => h.id !== 'cisterna').length;
    n += pl.columns.flat().length;
    n += pl.queue.filter((e) => e && e.id !== 'najezd').length;
  }
  return n;
}
