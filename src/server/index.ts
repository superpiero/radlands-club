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
import { Accounts } from './accounts';
import { pickPersist } from './persist';
import { type Client, Lobby, send } from './rooms';

const PORT = Number(process.env.PORT ?? 8080);
const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), 'data');
const DATA_FILE = join(DATA_DIR, 'rooms.json');
const HOST = process.env.HOST ?? '0.0.0.0';

const here = dirname(fileURLToPath(import.meta.url));
const candidates = [join(here, 'client'), join(here, '../../dist/client'), join(process.cwd(), 'dist/client')];
let staticDir: string | null = null;
function STATIC(): string {
  if (staticDir && existsSync(join(staticDir, 'index.html'))) return staticDir;
  staticDir = candidates.find((d) => existsSync(join(d, 'index.html'))) ?? candidates[0];
  return staticDir;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg',
};

const persist = pickPersist(DATA_DIR);
const accounts = new Accounts(null);
const lobby = new Lobby(accounts);
void DATA_FILE;
try {
  const a = await persist.load('accounts');
  if (a) accounts.loads(a);
  const r = await persist.load('rooms');
  const n = r ? lobby.loads(r) : 0;
  console.log(`  Úložiště: ${persist.name} (stoly: ${n}).`);
} catch (e) {
  console.error('Načtení uložených dat selhalo – startuji s prázdnými daty:', e);
}

let saving = false;
async function persistNow(force = false) {
  if (saving) return;
  saving = true;
  try {
    const r = lobby.dumps(force);
    if (r) await persist.save('rooms', r);
    const a = accounts.dumps(force);
    if (a) await persist.save('accounts', a);
  } catch (e) {
    console.warn('Ukládání selhalo:', e);
  } finally {
    saving = false;
  }
}

function json(res: import('node:http').ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

const apiHits = new Map<string, number[]>();

async function handleApi(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, path: string) {
  // tiny rate limit per IP
  const ip = req.socket.remoteAddress ?? '?';
  const now = Date.now();
  const hits = (apiHits.get(ip) ?? []).filter((t) => now - t < 10_000);
  hits.push(now);
  apiHits.set(ip, hits);
  if (hits.length > 40) return json(res, 429, { error: 'Příliš mnoho požadavků, zkus to za chvíli.' });

  let body: any = {};
  if (req.method === 'POST') {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const ch of req) {
      size += (ch as Buffer).length;
      if (size > 64 * 1024) return json(res, 413, { error: 'Příliš velký požadavek.' });
      chunks.push(ch as Buffer);
    }
    try { body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; } catch { return json(res, 400, { error: 'Neplatný JSON.' }); }
    if (typeof body !== 'object' || body === null) body = {};
  }
  const auth = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  const user = accounts.userByToken(auth);
  const need = () => { if (!user) { json(res, 401, { error: 'Nejsi přihlášen(a).' }); return false; } return true; };
  const out = (r: any) => json(res, 'error' in r ? 400 : 200, r);

  switch (`${req.method} ${path}`) {
    case 'POST /api/register': return out(accounts.register(body.name, body.password));
    case 'POST /api/login': return out(accounts.login(body.name, body.password));
    case 'POST /api/logout': accounts.logout(auth); return json(res, 200, { ok: true });
    case 'GET /api/me': if (!need()) return; return json(res, 200, { profile: accounts.profile(user!) });
    case 'POST /api/booster/open': if (!need()) return; return out(accounts.openBooster(user!));
    case 'POST /api/booster/buy': if (!need()) return; return out(accounts.buyBooster(user!));
    case 'POST /api/deck/save': if (!need()) return; return out(accounts.saveDeck(user!, body));
    case 'POST /api/deck/delete': if (!need()) return; return out(accounts.deleteDeck(user!, String(body.id ?? '')));
    default: return json(res, 404, { error: 'Neznámý požadavek.' });
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url.pathname).catch((e) => { console.error(e); json(res, 500, { error: 'Chyba serveru.' }); });
    return;
  }
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
  let file = join(STATIC(), path);
  if (!path || !existsSync(file) || statSync(file).isDirectory()) file = join(STATIC(), 'index.html');
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

wss.on('error', (e) => console.warn('wss error:', e.message));
server.on('clientError', (_e, sock) => { try { sock.destroy(); } catch { /* ignore */ } });
process.on('uncaughtException', (e) => console.error('uncaughtException (server keeps running):', e));
process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e));

const createHits = new WeakMap<object, number[]>();

wss.on('connection', (ws) => {
  const client: Client = { ws, token: '', name: 'Poutník', room: null, lastMsgs: [] };
  ws.on('error', (e) => console.warn('ws error:', e.message));
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
    if (client.lastMsgs.length > 40) return send(client, { t: 'error', msg: 'Zpomal trochu :)' });
    if (!msg || typeof msg !== 'object' || typeof (msg as { t?: unknown }).t !== 'string') return;

    try {
      handle(client, msg);
    } catch (e) {
      console.error('handler error:', e instanceof Error ? e.message : e);
      send(client, { t: 'error', msg: 'Neplatný požadavek.' });
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
    case 'hello': {
      c.token = String(msg.token ?? '').slice(0, 64) || Math.random().toString(36).slice(2);
      const user = accounts.userByToken(msg.account ? String(msg.account) : null);
      c.account = user ? user.name : null;
      c.name = user ? user.name : cleanName(msg.name);
      return;
    }
    case 'ping':
      return send(c, { t: 'pong', ts: msg.ts });
    case 'create': {
      if (!c.token) return send(c, { t: 'error', msg: 'Chybí identifikace.' });
      const now = Date.now();
      const hits = (createHits.get(c) ?? []).filter((t) => now - t < 60_000);
      if (hits.length >= 4) return send(c, { t: 'error', msg: 'Zakládáš stoly moc rychle, chvilku počkej.' });
      hits.push(now);
      createHits.set(c, hits);
      if (c.room) c.room.leave(c, true);
      const deckMode = msg.options?.deckMode === 'collection' ? 'collection' : 'classic';
      if (deckMode === 'collection' && !c.account) return send(c, { t: 'error', msg: 'Sběratelský stůl může založit jen přihlášený hráč.' });
      const ts = Number(msg.options?.turnSeconds ?? 0);
      const turnSeconds = [60, 90, 120].includes(ts) ? ts : 0;
      const room = lobby.create({ baseMode: msg.options?.baseMode === 'random' ? 'random' : 'draft', deckMode, turnSeconds });
      const err = room.join(c, false, msg.deckId ? String(msg.deckId) : undefined);
      if (err) {
        lobby.rooms.delete(room.code);
        send(c, { t: 'error', msg: err });
      }
      return;
    }
    case 'join': {
      if (!c.token) return send(c, { t: 'error', msg: 'Chybí identifikace.' });
      const room = lobby.get(String(msg.code ?? ''));
      if (!room) return send(c, { t: 'error', code: 'no_room', msg: `Stůl s kódem „${String(msg.code ?? '').toUpperCase().slice(0, 8)}“ neexistuje (možná vypršel nebo se restartoval server).` });
      if (c.room && c.room !== room) c.room.leave(c, true);
      const err = room.join(c, !!msg.spectate, msg.deckId ? String(msg.deckId) : undefined);
      if (err) send(c, { t: 'error', msg: err, });
      return;
    }
    case 'leave':
      if (c.room) c.room.leave(c, true);
      send(c, { t: 'left' });
      return;
    case 'act':
      if (!c.room) return send(c, { t: 'error', msg: 'Nejsi u žádného stolu.' });
      if (msg.action && typeof msg.action === 'object' && 'absent' in msg.action) delete (msg.action as { absent?: unknown }).absent;
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
    case 'claimWin':
      c.room?.claimWin(c);
      return;
  }
}

setInterval(() => lobby.sweep(), 60_000);
setInterval(() => lobby.tick(), 1_000);
setInterval(() => { void persistNow(); }, 3000);
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    void persistNow(true).finally(() => process.exit(0));
    setTimeout(() => process.exit(0), 4000);
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
  console.log(`     Statické soubory: ${STATIC()}\n`);
});
