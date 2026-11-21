import { describe, expect, it } from 'vitest';
import { Lobby, Room, type Client } from '../src/server/rooms';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function fakeClient(token: string, name: string): Client & { sent: any[] } {
  const sent: any[] = [];
  return { ws: { readyState: 1, send: (s: string) => sent.push(JSON.parse(s)) } as any, token, name, room: null, lastMsgs: [], sent };
}

describe('room persistence', () => {
  it('saves and restores a running game via replay', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pk-'));
    const file = join(dir, 'rooms.json');
    const lobby = new Lobby();
    const room = lobby.create({ baseMode: 'random' });
    const a = fakeClient('tokA', 'Alena');
    const b = fakeClient('tokB', 'Bob');
    room.join(a);
    room.join(b);
    expect(room.game).not.toBeNull();
    const g = room.game!;
    room.act(g.state.coinWinner === 0 ? a : b, { t: 'chooseFirst', first: 0 });
    room.act(a, { t: 'drawCard' } as any); // likely fails (1 water) – must not be recorded
    room.act(a, { t: 'endTurn' });
    const before = JSON.stringify(g.state.players);
    lobby.save(file, true);

    const lobby2 = new Lobby();
    expect(lobby2.load(file)).toBe(1);
    const r2 = lobby2.get(room.code) as Room;
    expect(JSON.stringify(r2.game!.state.players)).toBe(before);
    // reconnect by token gets the same seat
    const b2 = fakeClient('tokB', 'Bob');
    r2.join(b2);
    expect(r2.seatOf(b2)).toBe(1);
    expect(b2.sent.some((m) => m.t === 'state')).toBe(true);
  });
});

describe('absent players', () => {
  it('auto-answers a prompt of a disconnected player and allows claiming the win', () => {
    const lobby = new Lobby();
    const room = lobby.create({ baseMode: 'random' });
    const a = fakeClient('ta', 'A');
    const b = fakeClient('tb', 'B');
    room.join(a);
    room.join(b);
    const g = room.game!;
    room.act(g.state.coinWinner === 0 ? a : b, { t: 'chooseFirst', first: 0 });
    // B goes away; give A a raid in slot 1 so that B must choose a base at A's next turn start
    room.leave(b, false);
    g.state.players[0].queue[0] = { uid: 'rx', id: 'najezd' };
    g.state.players[0].raidHome = false;
    room.act(a, { t: 'endTurn' });
    // B's turn now; end it for B? B is away -> A waits. Simulate time passing.
    const seatB = (room as any).seats[1];
    seatB.awaySince = Date.now() - 200_000;
    room.claimWin(a);
    expect(g.state.phase).toBe('over');
    expect(g.state.winner).toBe(0);
  });
});

describe('turn timer', () => {
  it('ends the turn automatically when the time runs out', () => {
    const lobby = new Lobby();
    const room = lobby.create({ baseMode: 'random', turnSeconds: 60 });
    const a = fakeClient('ta2', 'A');
    const b = fakeClient('tb2', 'B');
    room.join(a);
    room.join(b);
    const g = room.game!;
    room.act(g.state.coinWinner === 0 ? a : b, { t: 'chooseFirst', first: 0 });
    const t0 = Date.now();
    room.tick(t0);
    expect(room.turnLeft(t0)).toBe(60_000);
    expect(g.state.active).toBe(0);
    room.tick(t0 + 61_000);
    expect(g.state.active).toBe(1);
    expect(room.chat.some((l) => l.text.includes('čas vypršel'))).toBe(true);
  });
});
