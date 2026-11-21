#!/usr/bin/env node
// Zero-dependency CLI for the OpenAI API (images + text), used by the
// chatgpt-design skill. Node 20+.
//
//   node gpt.mjs check
//   node gpt.mjs models
//   node gpt.mjs image  --prompt "..." [--out a.png | --out-dir dir] [--n 2] [--size 1024x1536]
//                       [--quality low|medium|high|auto] [--background transparent|opaque|auto]
//                       [--format png|webp|jpeg] [--ref a.png ...] [--mask m.png]
//                       [--fidelity high|low] [--style style-lock.txt] [--model id]
//   node gpt.mjs batch  jobs.json [--concurrency 2] [--force] [--dry-run]
//   node gpt.mjs cards  [docs/art-prompts.json] --ids pumpar,bara | --kind survivor [--quality medium] [--ref style.png]
//   node gpt.mjs chat   --prompt "..." [--system "..."] [--image x.png ...] [--json] [--out f.md]
//   node gpt.mjs gallery <dir>
//
// Auth: OPENAI_API_KEY, or a key file (OPENAI_API_KEY_FILE, default ~/.config/openai/api_key).
// Behind the Claude Code cloud proxy the key is injected by the proxy, so none is needed here.
// Optional: OPENAI_BASE_URL, OPENAI_ORG_ID, OPENAI_PROJECT_ID, OPENAI_IMAGE_MODEL, OPENAI_TEXT_MODEL.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';

// Node's built-in fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY=1 (Node >= 22.21 / 24.5).
// Re-run ourselves with it set so the same command works locally and behind a proxy.
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, ['--disable-warning=UNDICI-EHPA', ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1' },
  });
  process.exit(r.status ?? 1);
}

const BASE = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

class ApiError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function apiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  const file = process.env.OPENAI_API_KEY_FILE || join(homedir(), '.config', 'openai', 'api_key');
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  // Claude Code cloud sessions: the agent proxy injects the saved credential into requests
  // to api.openai.com, so a placeholder is enough here.
  if (process.env.CCR_AGENT_PROXY_ENABLED) return 'sk-proxy-injected';
  fail(
    'No OpenAI API key. Set OPENAI_API_KEY (or put the key in ~/.config/openai/api_key).\n' +
    'A ChatGPT Plus/Pro subscription does not include API access: create a key at\n' +
    'https://platform.openai.com/api-keys (API usage is billed separately).',
  );
}

function headers(extra = {}) {
  const h = { Authorization: `Bearer ${apiKey()}`, ...extra };
  if (process.env.OPENAI_ORG_ID) h['OpenAI-Organization'] = process.env.OPENAI_ORG_ID;
  if (process.env.OPENAI_PROJECT_ID) h['OpenAI-Project'] = process.env.OPENAI_PROJECT_ID;
  return h;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** fetch with retries on 429/5xx/network errors. `makeBody` is called per attempt (FormData can't be reused safely). */
async function call(method, path, makeBody, { json = true, timeoutMs = 300_000, retries = 4 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res;
    try {
      const body = makeBody ? makeBody() : undefined;
      const isForm = body instanceof FormData;
      res = await fetch(`${BASE}${path}`, {
        method,
        headers: headers(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
        body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      lastErr = e;
      const cause = e.cause?.code || e.cause?.message || e.name;
      if (attempt < retries) { await sleep(2000 * 2 ** attempt); continue; }
      throw new Error(
        `network error calling ${BASE}${path}: ${e.message}${cause ? ` (${cause})` : ''}\n` +
        'If this runs in a Claude Code cloud session, api.openai.com may not be allowed by the network policy.',
      );
    }
    const text = await res.text();
    if (res.ok) return json ? JSON.parse(text) : text;
    let msg = text, code;
    try { const j = JSON.parse(text); msg = j.error?.message || text; code = j.error?.code || j.error?.type; } catch {}
    const billing = /quota|credit|billing/i.test(code || '');
    if ((res.status === 429 || res.status >= 500) && attempt < retries && !billing) {
      const ra = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 3000 * 2 ** attempt);
      lastErr = new ApiError(res.status, msg, code);
      continue;
    }
    throw new ApiError(res.status, msg, code);
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Models

let modelIds;
async function listModels() {
  if (!modelIds) modelIds = (await call('GET', '/models')).data.map((m) => m.id).sort();
  return modelIds;
}

const isSnapshot = (id) => /\d{4}-\d{2}-\d{2}$/.test(id);

// Ranking: highest version first, then the plain id over codename variants (e.g. "-flare"),
// then alphabetical. Small tiers are only used when nothing else exists.
function rankModels(ids, re, small) {
  const all = ids.filter((id) => re.test(id) && !isSnapshot(id));
  const big = all.filter((id) => !small.test(id));
  const c = big.length ? big : all;
  const ver = (id) => parseFloat(id.match(re)[1]);
  const plain = (id) => (id.replace(re, '') === '' ? 1 : 0);
  return c.sort((a, b) => ver(b) - ver(a) || plain(b) - plain(a) || a.localeCompare(b));
}
const IMAGE_RE = /^gpt-image-(\d+(?:\.\d+)?)/;
const TEXT_RE = /^gpt-(\d+(?:\.\d+)?)(?=$|-[a-z]+$)/;
const TEXT_SKIP = /-(mini|nano|pro|codex|chat|audio|realtime|search|transcribe|tts|live|instruct|oss)/;
const imageCandidates = (ids) => rankModels(ids, IMAGE_RE, /mini|nano/);
const textCandidates = (ids) => rankModels(ids.filter((id) => !TEXT_SKIP.test(id)), TEXT_RE, /^$/);
const bestImageModel = (ids) => imageCandidates(ids)[0];
const bestTextModel = (ids) => textCandidates(ids)[0];

/** Project pin file (committed), so a whole card set keeps using the same models across sessions. */
function pinned(key) {
  const file = process.env.GPT_DESIGN_CONFIG || join('design', 'gpt.json');
  if (!existsSync(file)) return undefined;
  try { return JSON.parse(readFileSync(file, 'utf8'))[key]; } catch { fail(`invalid JSON in ${file}`); }
}

async function imageModel(explicit) {
  const m = explicit || process.env.OPENAI_IMAGE_MODEL || pinned('imageModel');
  if (m) return m;
  try { return bestImageModel(await listModels()) || 'gpt-image-1'; } catch { return 'gpt-image-1'; }
}

async function textModel(explicit) {
  const m = explicit || process.env.OPENAI_TEXT_MODEL || pinned('textModel');
  if (m) return m;
  try { return bestTextModel(await listModels()) || 'gpt-5'; } catch { return 'gpt-5'; }
}

// ---------------------------------------------------------------------------
// Images

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'image';
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function readStyle(path) {
  if (!path) return '';
  if (!existsSync(path)) fail(`style file not found: ${path}`);
  return (await readFile(path, 'utf8')).trim();
}

function outPaths({ out, outDir, n, format, prompt }) {
  const ext = `.${format === 'jpeg' ? 'jpg' : format}`;
  if (out) {
    const e = extname(out) || ext;
    const stem = extname(out) ? out.slice(0, -extname(out).length) : out;
    return n === 1 ? [stem + e] : Array.from({ length: n }, (_, i) => `${stem}-${i + 1}${e}`);
  }
  const base = join(outDir || 'design/drafts', `${stamp()}-${slug(prompt)}`);
  return n === 1 ? [base + ext] : Array.from({ length: n }, (_, i) => `${base}-${i + 1}${ext}`);
}

/**
 * Generate (no refs) or edit/compose (with refs) images. Returns saved file paths.
 * opts: prompt, style, n, size, quality, background, format, compression, refs[], mask, fidelity, model, moderation, out, outDir
 */
async function makeImages(opts) {
  const model = await imageModel(opts.model);
  const n = Number(opts.n || 1);
  const format = opts.format || 'png';
  const prompt = [opts.styleText, opts.prompt].filter(Boolean).join('\n\n');
  if (!prompt) fail('empty prompt');
  const refs = opts.refs || [];
  for (const r of [...refs, opts.mask].filter(Boolean)) {
    if (!existsSync(r)) fail(`reference image not found: ${r}`);
    if (!MIME[extname(r).toLowerCase()]) fail(`reference must be a png/jpg/webp image: ${r}`);
  }

  const params = { model, prompt, n };
  if (opts.size) params.size = opts.size;
  if (opts.quality) params.quality = opts.quality;
  if (opts.background) params.background = opts.background;
  if (opts.format) params.output_format = format;
  if (opts.compression) params.output_compression = Number(opts.compression);
  if (opts.moderation) params.moderation = opts.moderation;
  if (opts.fidelity) params.input_fidelity = opts.fidelity;

  let res;
  const started = Date.now();
  if (refs.length === 0) {
    delete params.input_fidelity;
    res = await call('POST', '/images/generations', () => params);
  } else {
    const files = await Promise.all(refs.map(async (r) => ({ name: basename(r), buf: await readFile(r), type: MIME[extname(r).toLowerCase()] || 'image/png' })));
    const maskBuf = opts.mask ? await readFile(opts.mask) : null;
    res = await call('POST', '/images/edits', () => {
      const f = new FormData();
      for (const [k, v] of Object.entries(params)) f.append(k, String(v));
      for (const file of files) f.append('image[]', new Blob([file.buf], { type: file.type }), file.name);
      if (maskBuf) f.append('mask', new Blob([maskBuf], { type: 'image/png' }), basename(opts.mask));
      return f;
    });
  }

  const paths = outPaths({ out: opts.out, outDir: opts.outDir, n: res.data.length, format, prompt: opts.prompt || 'image' });
  const saved = [];
  for (let i = 0; i < res.data.length; i++) {
    const item = res.data[i];
    let buf;
    if (item.b64_json) buf = Buffer.from(item.b64_json, 'base64');
    else if (item.url) buf = Buffer.from(await (await fetch(item.url)).arrayBuffer());
    else continue;
    const p = paths[i];
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, buf);
    const meta = {
      prompt: opts.prompt, style: opts.styleFile || null, model, endpoint: refs.length ? 'images/edits' : 'images/generations',
      params: { ...params, prompt: undefined, model: undefined }, refs, mask: opts.mask || null,
      revised_prompt: item.revised_prompt, usage: res.usage, seconds: Math.round((Date.now() - started) / 1000),
      created: new Date().toISOString(),
    };
    await writeFile(p.replace(/\.[a-z]+$/i, '.json'), JSON.stringify(meta, null, 2));
    saved.push(p);
  }
  return { saved, usage: res.usage, model };
}

function usageLine(u) {
  if (!u) return '';
  return ` [tokens in ${u.input_tokens ?? '?'} / out ${u.output_tokens ?? '?'}]`;
}

function explain(e) {
  if (!(e instanceof ApiError)) return e.message;
  let hint = '';
  if (e.status === 401) hint = ' -> the API key is missing or invalid.';
  else if (e.status === 403 && /verif/i.test(e.message)) hint = ' -> gpt-image models require a verified organization: https://platform.openai.com/settings/organization/general';
  else if (/quota|credit|billing/i.test(e.code || '')) hint = ' -> the API account has no credit (separate from a ChatGPT subscription): add some at https://platform.openai.com/settings/organization/billing';
  else if (e.code === 'moderation_blocked' || /safety|moderation/i.test(e.message)) hint = ' -> rephrase the prompt (no real brands, IP, gore).';
  else if (e.code === 'model_not_found') hint = ' -> run `models` and pass --model with an available id.';
  return `HTTP ${e.status}${e.code ? ` ${e.code}` : ''}: ${e.message}${hint}`;
}

// ---------------------------------------------------------------------------
// Commands

async function cmdCheck() {
  const ids = await listModels();
  const show = (label, chosen, cands) => {
    const src = chosen.src === 'auto' ? 'auto-picked' : `from ${chosen.src}`;
    console.log(`${label} ${chosen.id || 'NONE visible to this key'} (${src})`);
    const top = cands[0] && cands[0].match(/\d+(?:\.\d+)?/)[0];
    const alts = cands.filter((c) => c !== chosen.id && c.match(/\d+(?:\.\d+)?/)[0] === top);
    if (alts.length) console.log(`  same-version alternatives: ${alts.join(', ')} (pin one in design/gpt.json)`);
  };
  const pick = (explicitEnv, key, cands) =>
    process.env[explicitEnv] ? { id: process.env[explicitEnv], src: explicitEnv }
      : pinned(key) ? { id: pinned(key), src: 'design/gpt.json' } : { id: cands[0], src: 'auto' };
  const ic = imageCandidates(ids), tc = textCandidates(ids);
  console.log(`ok: connected to ${BASE} (${ids.length} models visible)`);
  show('image model:', pick('OPENAI_IMAGE_MODEL', 'imageModel', ic), ic);
  show('text model: ', pick('OPENAI_TEXT_MODEL', 'textModel', tc), tc);
  console.log('note: listing models is free; billing problems only show up on a real generation.');
}

async function cmdModels() {
  const ids = await listModels();
  const img = ids.filter((id) => /^(gpt-image|dall-e|chatgpt-image)/.test(id));
  const txt = ids.filter((id) => /^(gpt-|o\d|chatgpt-)/.test(id) && !img.includes(id) && !/(audio|realtime|transcribe|tts|embedding|search|moderation)/.test(id));
  console.log('image models:\n  ' + (img.join('\n  ') || '(none)'));
  console.log('text models:\n  ' + (txt.join('\n  ') || '(none)'));
  console.log(`auto-pick -> image: ${bestImageModel(ids) || '-'}, text: ${bestTextModel(ids) || '-'}`);
}

const IMAGE_OPTS = {
  prompt: { type: 'string' }, 'prompt-file': { type: 'string' }, style: { type: 'string' },
  out: { type: 'string' }, 'out-dir': { type: 'string' }, n: { type: 'string' }, size: { type: 'string' },
  quality: { type: 'string' }, background: { type: 'string' }, format: { type: 'string' }, compression: { type: 'string' },
  ref: { type: 'string', multiple: true }, mask: { type: 'string' }, fidelity: { type: 'string' },
  model: { type: 'string' }, moderation: { type: 'string' },
};

async function cmdImage(argv) {
  const { values: v } = parseArgs({ args: argv, options: IMAGE_OPTS, allowPositionals: false });
  const prompt = v['prompt-file'] ? (await readFile(v['prompt-file'], 'utf8')).trim() : v.prompt;
  if (!prompt) fail('pass --prompt "..." or --prompt-file file.txt');
  const r = await makeImages({
    prompt, styleText: await readStyle(v.style), styleFile: v.style, n: v.n, size: v.size, quality: v.quality,
    background: v.background, format: v.format, compression: v.compression, refs: v.ref, mask: v.mask,
    fidelity: v.fidelity, model: v.model, moderation: v.moderation, out: v.out, outDir: v['out-dir'],
  });
  console.error(`model ${r.model}${usageLine(r.usage)}`);
  for (const p of r.saved) console.log(p);
}

async function cmdBatch(argv) {
  const { values: v, positionals } = parseArgs({
    args: argv, allowPositionals: true,
    options: { concurrency: { type: 'string' }, force: { type: 'boolean' }, 'dry-run': { type: 'boolean' }, only: { type: 'string' } },
  });
  const file = positionals[0];
  if (!file || !existsSync(file)) fail('usage: batch jobs.json [--concurrency 2] [--force] [--dry-run] [--only name1,name2]');
  await runJobs(JSON.parse(await readFile(file, 'utf8')), v);
}

/**
 * Card art straight from the game's own prompt list (docs/art-prompts.json, exported from
 * scripts/art/prompts.ts): one job per card id, full prompt, portrait 2:3 or landscape 3:2.
 */
async function cmdCards(argv) {
  const { values: v, positionals } = parseArgs({
    args: argv, allowPositionals: true,
    options: {
      ids: { type: 'string' }, kind: { type: 'string' }, quality: { type: 'string' }, n: { type: 'string' },
      'out-dir': { type: 'string' }, ref: { type: 'string', multiple: true }, fidelity: { type: 'string' }, model: { type: 'string' },
      extra: { type: 'string' }, concurrency: { type: 'string' }, force: { type: 'boolean' }, 'dry-run': { type: 'boolean' },
    },
  });
  const file = positionals[0] || 'docs/art-prompts.json';
  if (!existsSync(file)) fail(`${file} not found (regenerate it with: npx tsx scripts/art/export-prompts.ts)`);
  const data = JSON.parse(await readFile(file, 'utf8'));
  const ids = v.ids ? new Set(v.ids.split(',').map((x) => x.trim())) : null;
  const items = (data.items || []).filter((it) => (!ids || ids.has(it.id)) && (!v.kind || it.kind === v.kind));
  if (ids) for (const id of ids) if (!items.some((it) => it.id === id)) fail(`unknown card id in --ids: ${id}`);
  if (!items.length) fail('no cards selected (use --ids pumpar,bara or --kind survivor|operation|base)');
  const refNote = v.ref?.length ? ' Use the reference images only for rendering style, palette and line quality. Do not copy their subject, pose or composition.' : '';
  const spec = {
    defaults: { quality: v.quality || 'medium', outDir: v['out-dir'] || 'design/drafts/cards', refs: v.ref, fidelity: v.fidelity, model: v.model, n: v.n },
    jobs: items.map((it) => ({
      name: it.id,
      size: it.landscape ? '1536x1024' : '1024x1536',
      prompt: `${it.full}${refNote}${v.extra ? ` ${v.extra}` : ''}`,
    })),
  };
  await runJobs(spec, v);
}

async function runJobs(spec, v) {
  const d = spec.defaults || {};
  const only = v.only ? new Set(v.only.split(',')) : null;
  const styleCache = new Map();
  const jobs = (spec.jobs || []).filter((j) => !only || only.has(j.name));
  const plan = jobs.map((j) => {
    const o = { ...d, ...j };
    if (!o.name) fail('every job needs a "name" (used as the file name)');
    const fmt = o.format || 'png';
    const out = o.out || join(o.outDir || 'design/drafts/batch', `${o.name}.${fmt === 'jpeg' ? 'jpg' : fmt}`);
    const n = Number(o.n || 1);
    const first = n === 1 ? out : out.replace(/(\.[a-z]+)$/i, '-1$1');
    return { o, out, n, skip: !v.force && existsSync(first) };
  });
  const todo = plan.filter((p) => !p.skip);
  const images = todo.reduce((s, p) => s + p.n, 0);
  const byQuality = {};
  for (const p of todo) { const k = `${p.o.quality || 'auto'} ${p.o.size || 'auto'}`; byQuality[k] = (byQuality[k] || 0) + p.n; }
  console.error(`${jobs.length} jobs, ${plan.length - todo.length} already done, ${images} images to make: ` +
    Object.entries(byQuality).map(([k, c]) => `${c}x ${k}`).join(', '));
  if (v['dry-run']) { for (const p of todo) console.log(`would make ${p.out}${p.n > 1 ? ` (x${p.n})` : ''}`); return; }

  const conc = Math.max(1, Number(v.concurrency || spec.concurrency || 2));
  let next = 0, failed = 0;
  const worker = async () => {
    while (next < todo.length) {
      const { o, out, n } = todo[next++];
      if (o.style && !styleCache.has(o.style)) styleCache.set(o.style, await readStyle(o.style));
      try {
        const r = await makeImages({
          prompt: o.prompt, styleText: o.style ? styleCache.get(o.style) : o.styleText, styleFile: o.style,
          n, size: o.size, quality: o.quality, background: o.background, format: o.format, compression: o.compression,
          refs: o.refs, mask: o.mask, fidelity: o.fidelity, model: o.model, moderation: o.moderation, out,
        });
        for (const p of r.saved) console.log(p);
      } catch (e) {
        failed++;
        console.error(`FAILED ${o.name}: ${explain(e)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: conc }, worker));
  if (failed) { console.error(`${failed} job(s) failed; rerun the same command to retry only those.`); process.exit(2); }
}

async function cmdChat(argv) {
  const { values: v } = parseArgs({
    args: argv,
    options: {
      prompt: { type: 'string' }, 'prompt-file': { type: 'string' }, system: { type: 'string' }, 'system-file': { type: 'string' },
      image: { type: 'string', multiple: true }, json: { type: 'boolean' }, model: { type: 'string' }, out: { type: 'string' },
      effort: { type: 'string' },
    },
  });
  const prompt = v['prompt-file'] ? await readFile(v['prompt-file'], 'utf8') : v.prompt;
  if (!prompt) fail('pass --prompt "..." or --prompt-file file.txt');
  const system = v['system-file'] ? await readFile(v['system-file'], 'utf8') : v.system;
  const model = await textModel(v.model);
  const content = [{ type: 'input_text', text: prompt }];
  for (const img of v.image || []) {
    if (!existsSync(img)) fail(`image not found: ${img}`);
    const mime = MIME[extname(img).toLowerCase()] || 'image/png';
    content.push({ type: 'input_image', image_url: `data:${mime};base64,${(await readFile(img)).toString('base64')}` });
  }
  const body = { model, input: [{ role: 'user', content }] };
  if (system) body.instructions = system;
  if (v.json) body.text = { format: { type: 'json_object' } };
  if (v.effort) body.reasoning = { effort: v.effort };
  const res = await call('POST', '/responses', () => body);
  const text = (res.output || []).filter((o) => o.type === 'message').flatMap((o) => o.content || [])
    .filter((c) => c.type === 'output_text').map((c) => c.text).join('\n').trim();
  if (v.out) { await mkdir(dirname(v.out), { recursive: true }); await writeFile(v.out, text + '\n'); console.error(`saved ${v.out}`); }
  console.error(`model ${res.model || model}${usageLine(res.usage)}`);
  console.log(text);
}

async function cmdGallery(argv) {
  const dir = argv[0];
  if (!dir || !existsSync(dir)) fail('usage: gallery <dir>');
  const files = (await readdir(dir)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort();
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const items = await Promise.all(files.map(async (f) => {
    const metaPath = join(dir, f.replace(/\.[a-z]+$/i, '.json'));
    const meta = existsSync(metaPath) ? JSON.parse(await readFile(metaPath, 'utf8')) : {};
    const info = [meta.model, meta.params?.size, meta.params?.quality].filter(Boolean).join(' · ');
    return `<figure><a href="${esc(f)}" target="_blank"><img src="${esc(f)}" loading="lazy" alt="${esc(f)}"></a>
<figcaption><b>${esc(f)}</b><span>${esc(info)}</span>${meta.prompt ? `<details><summary>prompt</summary><p>${esc(meta.prompt)}</p></details>` : ''}</figcaption></figure>`;
  }));
  const html = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(basename(resolve(dir)))}</title><style>
:root{color-scheme:dark}body{margin:0;padding:16px;background:#17120e;color:#f1e6d2;font:15px/1.35 system-ui,sans-serif}
h1{font-size:18px;margin:0 0 12px;color:#e8d5b0}main{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}
figure{margin:0;background:#211a14;border:1px solid rgba(232,213,176,.14);border-radius:10px;overflow:hidden}
img{display:block;width:100%;height:auto;background:#2a221b}figcaption{padding:8px 10px;display:grid;gap:4px}
figcaption span{color:#b6a68c;font-size:13px}details p{white-space:pre-wrap;font-size:13px;color:#cdb78e;margin:6px 0 0}
</style></head><body><h1>${esc(relative(process.cwd(), resolve(dir)) || dir)} — ${files.length} obrázků</h1><main>${items.join('\n')}</main></body></html>`;
  const out = join(dir, 'index.html');
  await writeFile(out, html);
  console.log(out);
}

const [cmd, ...rest] = process.argv.slice(2);
const commands = { check: cmdCheck, models: cmdModels, image: cmdImage, batch: cmdBatch, cards: cmdCards, chat: cmdChat, gallery: cmdGallery };
if (!commands[cmd]) {
  console.error('usage: node gpt.mjs <check|models|image|batch|cards|chat|gallery> [options]  (see header of this file)');
  process.exit(1);
}
commands[cmd](rest).catch((e) => { console.error(`error: ${explain(e)}`); process.exit(1); });
