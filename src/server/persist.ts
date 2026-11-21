// Persistence backends: local JSON files (default) or Upstash Redis REST (for hosts with ephemeral disks).
//   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN  -> Upstash
//   otherwise DATA_DIR (default ./data)                 -> files

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface Persist {
  name: string;
  load(key: 'accounts' | 'rooms'): Promise<string | null>;
  save(key: 'accounts' | 'rooms', json: string): Promise<void>;
}

export class FilePersist implements Persist {
  name: string;
  constructor(private dir: string) { this.name = `soubory v ${dir}`; }
  private file(key: string) { return join(this.dir, `${key}.json`); }
  async load(key: 'accounts' | 'rooms'): Promise<string | null> {
    const f = this.file(key);
    return existsSync(f) ? readFileSync(f, 'utf8') : null;
  }
  async save(key: 'accounts' | 'rooms', json: string): Promise<void> {
    const f = this.file(key);
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(`${f}.tmp`, json);
    renameSync(`${f}.tmp`, f);
  }
}

export class UpstashPersist implements Persist {
  name = 'Upstash Redis';
  constructor(private url: string, private token: string, private prefix = 'pk:') {}
  private async cmd(args: (string | number)[]): Promise<unknown> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(args),
    });
    const body = (await res.json()) as { result?: unknown; error?: string };
    if (!res.ok || body.error) throw new Error(`Upstash: ${body.error ?? res.status}`);
    return body.result;
  }
  async load(key: 'accounts' | 'rooms'): Promise<string | null> {
    const r = await this.cmd(['GET', this.prefix + key]);
    return typeof r === 'string' ? r : null;
  }
  async save(key: 'accounts' | 'rooms', json: string): Promise<void> {
    await this.cmd(['SET', this.prefix + key, json]);
  }
}

export function pickPersist(dataDir: string): Persist {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return new UpstashPersist(url.replace(/\/$/, ''), token);
  return new FilePersist(dataDir);
}
