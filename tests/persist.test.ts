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
