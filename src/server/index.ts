// HTTP + WebSocket game server.
//   npm run build && npm start      -> http://localhost:8080
// Environment: PORT (default 8080), HOST (default 0.0.0.0)

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import type { ClientMsg } from '../shared/protocol';
import { PROTOCOL_VERSION } from '../shared/protocol';
import { type Client, Lobby, send } from './rooms';

const PORT = Number(process.env.PORT ?? 8080);
const DATA_FILE = join(process.env.DATA_DIR ?? join(process.cwd(), 'data'), 'rooms.json');
const HOST = process.env.HOST ?? '0.0.0.0';

const here = dirname(fileURLToPath(import.meta.url));
const candidates = [join(here, 'client'), join(here, '../../dist/client'), join(process.cwd(), 'dist/client')];
const STATIC_DIR = candidates.find((d) => existsSync(join(d, 'index.html'))) ?? candidates[0];

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg',
};

const lobby = new Lobby();
const restored = lobby.load(DATA_FILE);
if (restored) console.log(`  Obnoveno ${restored} rozehraných stolů z ${DATA_FILE}`);

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: lobby.rooms.size }));
    return;
  }
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  if (path.includes('..')) {
    res.writeHead(400);
    res.end();
    return;
  }
  let file = join(STATIC_DIR, path);
  if (!path || !existsSync(file) || statSync(file).isDirectory()) file = join(STATIC_DIR, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Klient není sestavený. Spusť "npm run build".');
    return;
  }
  const ext = extname(file);
  res.writeHead(200, {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  createReadStream(file).pipe(res);
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });

wss.on('connection', (ws) => {
  const client: Client = { ws, token: '', name: 'Poutník', room: null, lastMsgs: [] };
  let alive = true;
  ws.on('pong', () => { alive = true; });
  const hb = setInterval(() => {
    if (!alive) { ws.terminate(); return; }
    alive = false;
    try { ws.ping(); } catch { /* ignore */ }
  }, 25000);

  send(client, { t: 'welcome', version: PROTOCOL_VERSION });

  ws.on('message', (raw) => {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    // naive flood protection
    const now = Date.now();
    client.lastMsgs = client.lastMsgs.filter((t) => now - t < 5000);
    client.lastMsgs.push(now);
    if (client.lastMsgs.length > 60) return send(client, { t: 'error', msg: 'Zpomal trochu :)' });

    try {
      handle(client, msg);
    } catch (e) {
      console.error('handler error', e);
      send(client, { t: 'error', msg: 'Chyba serveru.' });
    }
  });

  ws.on('close', () => {
    clearInterval(hb);
    if (client.room) client.room.leave(client, false);
  });
});

function cleanName(n: unknown): string {
  const s = String(n ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  return s || 'Poutník';
}

function handle(c: Client, msg: ClientMsg) {
  switch (msg.t) {
    case 'hello':
      c.token = String(msg.token ?? '').slice(0, 64) || Math.random().toString(36).slice(2);
      c.name = cleanName(msg.name);
      return;
    case 'ping':
      return send(c, { t: 'pong', ts: msg.ts });
    case 'create': {
      if (!c.token) return send(c, { t: 'error', msg: 'Chybí identifikace.' });
      if (c.room) c.room.leave(c, true);
      const room = lobby.create({ baseMode: msg.options?.baseMode === 'random' ? 'random' : 'draft' });
      room.join(c);
      return;
    }
    case 'join': {
      if (!c.token) return send(c, { t: 'error', msg: 'Chybí identifikace.' });
      const room = lobby.get(String(msg.code ?? ''));
      if (!room) return send(c, { t: 'error', msg: `Stůl s kódem „${String(msg.code ?? '').toUpperCase()}“ neexistuje.` });
      if (c.room && c.room !== room) c.room.leave(c, true);
      const err = room.join(c, !!msg.spectate);
      if (err) send(c, { t: 'error', msg: err });
      return;
    }
    case 'leave':
      if (c.room) c.room.leave(c, true);
      send(c, { t: 'left' });
      return;
    case 'act':
      if (!c.room) return send(c, { t: 'error', msg: 'Nejsi u žádného stolu.' });
      c.room.act(c, msg.action);
      return;
    case 'chat':
      c.room?.chatFrom(c, String(msg.text ?? ''));
      return;
    case 'emote':
      c.room?.emoteFrom(c, String(msg.id ?? ''));
      return;
    case 'rematch':
      c.room?.requestRematch(c);
      return;
  }
}

setInterval(() => lobby.sweep(), 60_000);
setInterval(() => {
  try { lobby.save(DATA_FILE); } catch (e) { console.warn('Ukládání stolů selhalo:', e); }
}, 3000);
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    try { lobby.save(DATA_FILE, true); } catch { /* ignore */ }
    process.exit(0);
  });
}

server.listen(PORT, HOST, () => {
  const addrs: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) addrs.push(a.address);
  }
  console.log('\n  💧 POSLEDNÍ KAPKA – herní server běží');
  console.log(`     Lokálně:      http://localhost:${PORT}`);
  for (const a of addrs) console.log(`     V síti/LAN:   http://${a}:${PORT}`);
  console.log(`     Statické soubory: ${STATIC_DIR}\n`);
});
